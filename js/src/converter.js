import { Jimp } from "jimp";
import {
  applyGamma,
  percentileStretch,
  srgb8ToLstar,
} from "./luminance.js";
import { DEFAULT_RAMP, getRamp } from "./ramps.js";

/**
 * @typedef {Object} AsciiOptions
 * @property {number} [columns=80]
 * @property {number} [cellAspect=0.5]
 * @property {string} [ramp]
 * @property {boolean} [invert=false]
 * @property {boolean} [autocontrast=true]
 * @property {number} [brightness=0]
 * @property {number} [contrast=1]
 * @property {number} [gamma=1]
 * @property {number} [edgeBoost=0.15]
 * @property {boolean} [dither=false]
 */

/** @returns {Required<AsciiOptions>} */
export function normalizeOptions(options = {}) {
  return {
    columns: options.columns ?? 80,
    cellAspect: options.cellAspect ?? 0.5,
    ramp: options.ramp ?? DEFAULT_RAMP,
    invert: Boolean(options.invert),
    autocontrast: options.autocontrast !== false,
    brightness: options.brightness ?? 0,
    contrast: options.contrast ?? 1,
    gamma: options.gamma ?? 1,
    edgeBoost: options.edgeBoost ?? 0.15,
    dither: Boolean(options.dither),
  };
}

function resizeForCells(image, columns, cellAspect) {
  const cols = Math.max(1, Math.min(Math.trunc(columns), 1000));
  const aspect = Math.max(0.2, Math.min(Number(cellAspect), 1.5));
  const srcW = image.bitmap.width;
  const srcH = image.bitmap.height;
  const rows = Math.max(1, Math.round((srcH / srcW) * cols * aspect));
  return image.clone().resize({ w: cols, h: rows });
}

function cellLuminanceGrid(image) {
  const { width, height, data } = image.bitmap;
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) * 4;
      row.push(srgb8ToLstar(data[i], data[i + 1], data[i + 2]));
    }
    grid.push(row);
  }
  return grid;
}

/** Simple Sobel magnitude on L* grid, normalized 0..1. */
function edgeGridFromLuma(grid) {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out = Array.from({ length: h }, () => Array(w).fill(0));
  let maxV = 1e-9;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -grid[y - 1][x - 1] +
        grid[y - 1][x + 1] -
        2 * grid[y][x - 1] +
        2 * grid[y][x + 1] -
        grid[y + 1][x - 1] +
        grid[y + 1][x + 1];
      const gy =
        -grid[y - 1][x - 1] -
        2 * grid[y - 1][x] -
        grid[y - 1][x + 1] +
        grid[y + 1][x - 1] +
        2 * grid[y + 1][x] +
        grid[y + 1][x + 1];
      const mag = Math.hypot(gx, gy);
      out[y][x] = mag;
      if (mag > maxV) maxV = mag;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[y][x] /= maxV;
  }
  return out;
}

function adjust(values, opts) {
  let data = values;
  if (opts.autocontrast) data = percentileStretch(data);
  return data.map((v) => {
    let x = applyGamma(v, opts.gamma);
    x = (x - 0.5) * opts.contrast + 0.5 + opts.brightness;
    return Math.max(0, Math.min(1, x));
  });
}

function floydSteinberg(grid, levels) {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const work = grid.map((row) => row.slice());
  const step = 1 / Math.max(levels - 1, 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const old = work[y][x];
      const neu = Math.round(old / step) * step;
      work[y][x] = Math.max(0, Math.min(1, neu));
      const err = old - neu;
      if (x + 1 < w) work[y][x + 1] += (err * 7) / 16;
      if (y + 1 < h && x > 0) work[y + 1][x - 1] += (err * 3) / 16;
      if (y + 1 < h) work[y + 1][x] += (err * 5) / 16;
      if (y + 1 < h && x + 1 < w) work[y + 1][x + 1] += (err * 1) / 16;
    }
  }
  return work.map((row) => row.map((v) => Math.max(0, Math.min(1, v))));
}

function lumaToChar(luma, ramp, invert) {
  const glyphBrightness = invert ? 1 - luma : luma;
  let idx = Math.round((1 - glyphBrightness) * (ramp.length - 1));
  idx = Math.max(0, Math.min(ramp.length - 1, idx));
  return ramp[idx];
}

/**
 * Convert a Jimp image instance to ASCII art.
 * @param {import("jimp").Jimp} image
 * @param {AsciiOptions} [options]
 */
export function convertImage(image, options = {}) {
  const opts = normalizeOptions(options);
  const ramp = getRamp(opts.ramp);
  if (ramp.length < 2) throw new Error("Ramp needs at least 2 characters");

  // Flatten transparency onto mid-gray.
  const flat = image.clone();
  flat.scan(0, 0, flat.bitmap.width, flat.bitmap.height, function (x, y, idx) {
    const a = this.bitmap.data[idx + 3] / 255;
    const bg = 128;
    this.bitmap.data[idx] = Math.round(this.bitmap.data[idx] * a + bg * (1 - a));
    this.bitmap.data[idx + 1] = Math.round(this.bitmap.data[idx + 1] * a + bg * (1 - a));
    this.bitmap.data[idx + 2] = Math.round(this.bitmap.data[idx + 2] * a + bg * (1 - a));
    this.bitmap.data[idx + 3] = 255;
  });

  const resized = resizeForCells(flat, opts.columns, opts.cellAspect);
  let grid = cellLuminanceGrid(resized);

  if (opts.edgeBoost > 0) {
    const edges = edgeGridFromLuma(grid);
    const boost = Math.max(0, Math.min(1, opts.edgeBoost));
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        grid[y][x] = Math.max(0, Math.min(1, grid[y][x] * (1 - boost * edges[y][x])));
      }
    }
  }

  const flatLuma = grid.flat();
  const adjusted = adjust(flatLuma, opts);
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  let rebuilt = [];
  for (let y = 0; y < h; y++) {
    rebuilt.push(adjusted.slice(y * w, (y + 1) * w));
  }
  if (opts.dither) rebuilt = floydSteinberg(rebuilt, ramp.length);

  return rebuilt
    .map((row) => row.map((luma) => lumaToChar(luma, ramp, opts.invert)).join(""))
    .join("\n");
}

/**
 * @param {string} path
 * @param {AsciiOptions} [options]
 */
export async function convertPath(path, options = {}) {
  const image = await Jimp.read(path);
  return convertImage(image, options);
}

/**
 * @param {Buffer} buffer
 * @param {AsciiOptions} [options]
 */
export async function convertBuffer(buffer, options = {}) {
  const image = await Jimp.read(buffer);
  return convertImage(image, options);
}
