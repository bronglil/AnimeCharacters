import { Jimp } from "jimp";
import {
  applyGamma,
  percentileStretch,
  srgb8ToLstar,
  srgbToLinear,
} from "./luminance.js";
import { DEFAULT_RAMP, getRamp } from "./ramps.js";

/**
 * @typedef {Object} AsciiOptions
 * @property {number} [columns=80]
 * @property {number} [cellAspect=0.5]  // like image-to-ascii pxWidth=2
 * @property {string} [ramp]
 * @property {boolean} [invert=false]
 * @property {boolean} [autocontrast=true]
 * @property {number} [brightness=0]
 * @property {number} [contrast=1]
 * @property {number} [gamma=1]
 * @property {number} [edgeBoost=0]
 * @property {boolean} [dither=false]
 * @property {"lstar"|"average"} [metric="lstar"]
 * @property {"fill"|"relief"|"auto"} [style="auto"]
 * @property {number} [reliefHollow=0.75]
 * @property {number} [reliefEdge=0.9]
 * @property {number} [reliefBase=0.55]
 * @property {number} [localContrast=0.35]
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
    edgeBoost: options.edgeBoost ?? 0,
    dither: Boolean(options.dither),
    metric: options.metric === "average" ? "average" : "lstar",
    style: options.style ?? "auto",
    reliefHollow: options.reliefHollow ?? 0.95,
    reliefEdge: options.reliefEdge ?? 0.95,
    reliefBase: options.reliefBase ?? 0.8,
    localContrast: options.localContrast ?? 0.35,
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function pixelMetric(r, g, b, a, metric) {
  const alpha = a / 255;
  if (metric === "average") {
    // image-to-ascii / asciify-pixel intensity, normalized to 0..1
    return ((r + g + b) * alpha) / (255 * 3);
  }
  // Composite on mid-gray then L*
  const bg = 128;
  const cr = Math.round(r * alpha + bg * (1 - alpha));
  const cg = Math.round(g * alpha + bg * (1 - alpha));
  const cb = Math.round(b * alpha + bg * (1 - alpha));
  return srgb8ToLstar(cr, cg, cb);
}

/**
 * Box-filter sample: average every source pixel that falls in an ASCII cell.
 * Much more accurate than resizing first then reading one pixel.
 */
function sampleLumaGrid(image, columns, cellAspect, metric) {
  const cols = Math.max(1, Math.min(Math.trunc(columns), 1000));
  const aspect = Math.max(0.2, Math.min(Number(cellAspect), 1.5));
  const srcW = image.bitmap.width;
  const srcH = image.bitmap.height;
  const rows = Math.max(1, Math.round((srcH / srcW) * cols * aspect));
  const { data } = image.bitmap;
  const grid = [];

  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor((cy * srcH) / rows);
    const y1 = Math.floor(((cy + 1) * srcH) / rows);
    const row = [];
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * srcW) / cols);
      const x1 = Math.floor(((cx + 1) * srcW) / cols);
      let sumLin = 0;
      let sumAvg = 0;
      let n = 0;
      for (let y = y0; y < Math.max(y1, y0 + 1); y++) {
        for (let x = x0; x < Math.max(x1, x0 + 1); x++) {
          const i = (srcW * y + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (metric === "average") {
            sumAvg += pixelMetric(r, g, b, a, "average");
          } else {
            const alpha = a / 255;
            const bg = 128;
            const cr = r * alpha + bg * (1 - alpha);
            const cg = g * alpha + bg * (1 - alpha);
            const cb = b * alpha + bg * (1 - alpha);
            // Accumulate in linear light for a true area average
            sumLin +=
              0.2126 * srgbToLinear(cr / 255) +
              0.7152 * srgbToLinear(cg / 255) +
              0.0722 * srgbToLinear(cb / 255);
          }
          n++;
        }
      }
      if (n === 0) {
        row.push(0.5);
      } else if (metric === "average") {
        row.push(sumAvg / n);
      } else {
        // Convert mean linear Y → L*
        const y = sumLin / n;
        // inline lightnessLstar
        const f =
          y <= (6 / 29) ** 3
            ? (y * (29 / 6) ** 2) / 3 + 4 / 29
            : y ** (1 / 3);
        row.push((116 * f - 16) / 100);
      }
    }
    grid.push(row);
  }
  return grid;
}

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

/** Chamfer distance to nearest background (non-mask) cell. */
function distanceTransform(mask) {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const INF = h * w + 1;
  const dist = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (mask[y][x] ? INF : 0)),
  );

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;
      if (y > 0) dist[y][x] = Math.min(dist[y][x], dist[y - 1][x] + 1);
      if (x > 0) dist[y][x] = Math.min(dist[y][x], dist[y][x - 1] + 1);
      if (y > 0 && x > 0) dist[y][x] = Math.min(dist[y][x], dist[y - 1][x - 1] + 1.414);
      if (y > 0 && x + 1 < w) dist[y][x] = Math.min(dist[y][x], dist[y - 1][x + 1] + 1.414);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      if (!mask[y][x]) continue;
      if (y + 1 < h) dist[y][x] = Math.min(dist[y][x], dist[y + 1][x] + 1);
      if (x + 1 < w) dist[y][x] = Math.min(dist[y][x], dist[y][x + 1] + 1);
      if (y + 1 < h && x + 1 < w) dist[y][x] = Math.min(dist[y][x], dist[y + 1][x + 1] + 1.414);
      if (y + 1 < h && x > 0) dist[y][x] = Math.min(dist[y][x], dist[y + 1][x - 1] + 1.414);
    }
  }
  return dist;
}

/**
 * Turn flat silhouettes into hollow-face / dense-shoulder busts
 * (the look of classic ASCII portrait examples).
 */
function applyRelief(lumaGrid, opts) {
  const h = lumaGrid.length;
  const w = lumaGrid[0]?.length ?? 0;
  const flat = lumaGrid.flat();
  const sorted = [...flat].sort((a, b) => a - b);
  const thr = sorted[Math.floor(sorted.length * 0.45)] ?? 0.5;

  const mask = lumaGrid.map((row) => row.map((v) => v < thr));
  const inkCount = mask.flat().filter(Boolean).length;
  if (inkCount < w * h * 0.05) {
    return lumaGrid.map((row) => row.slice());
  }

  const dist = distanceTransform(mask);
  let maxD = 1e-6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y][x] && dist[y][x] > maxD) maxD = dist[y][x];
    }
  }

  const out = Array.from({ length: h }, () => Array(w).fill(1));
  for (let y = 0; y < h; y++) {
    const depth = h <= 1 ? 0 : y / (h - 1);
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) {
        out[y][x] = 1;
        continue;
      }
      const d = dist[y][x] / maxD;
      const edge = Math.exp(-d * 5);
      const hollow = Math.pow(d, 0.85) * opts.reliefHollow;
      const shoulders = Math.pow(depth, 1.6) * opts.reliefBase;
      const faceLift = (1 - depth) * (1 - depth) * d * 0.55;
      // High luma → light glyph. Edges + base stay darker; face center lifts.
      let luma = clamp01(0.08 + hollow * 0.92 + faceLift);
      luma *= 1 - shoulders * 0.92;
      luma = Math.min(luma, 1 - edge * opts.reliefEdge);
      luma = luma * 0.9 + lumaGrid[y][x] * 0.1;
      out[y][x] = clamp01(luma);
    }
  }
  return out;
}

function applyLocalContrast(grid, amount) {
  if (amount <= 0) return grid;
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out = grid.map((row) => row.slice());
  const radius = 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
          sum += grid[yy][xx];
          n++;
        }
      }
      const mean = sum / n;
      out[y][x] = clamp01(mean + (grid[y][x] - mean) * (1 + amount));
    }
  }
  return out;
}

function isNearlyBinary(grid) {
  const flat = grid.flat();
  let lo = 0;
  let hi = 0;
  for (const v of flat) {
    if (v < 0.2) lo++;
    else if (v > 0.8) hi++;
  }
  return (lo + hi) / flat.length > 0.85;
}

function adjust(values, opts) {
  let data = values;
  if (opts.autocontrast) data = percentileStretch(data, 5, 95);
  return data.map((v) => {
    let x = applyGamma(v, opts.gamma);
    x = (x - 0.5) * opts.contrast + 0.5 + opts.brightness;
    return clamp01(x);
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
      work[y][x] = clamp01(neu);
      const err = old - neu;
      if (x + 1 < w) work[y][x + 1] += (err * 7) / 16;
      if (y + 1 < h && x > 0) work[y + 1][x - 1] += (err * 3) / 16;
      if (y + 1 < h) work[y + 1][x] += (err * 5) / 16;
      if (y + 1 < h && x + 1 < w) work[y + 1][x + 1] += (err * 1) / 16;
    }
  }
  return work.map((row) => row.map((v) => clamp01(v)));
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

  let grid = sampleLumaGrid(image, opts.columns, opts.cellAspect, opts.metric);

  const useRelief =
    opts.style === "relief" || (opts.style === "auto" && isNearlyBinary(grid));

  if (useRelief) {
    grid = applyRelief(grid, opts);
  } else {
    if (opts.localContrast > 0) {
      grid = applyLocalContrast(grid, opts.localContrast);
    }
    if (opts.edgeBoost > 0) {
      const edges = edgeGridFromLuma(grid);
      const boost = clamp01(opts.edgeBoost);
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          grid[y][x] = clamp01(grid[y][x] * (1 - boost * edges[y][x]));
        }
      }
    }
  }

  const flat = grid.flat();
  const adjustOpts = useRelief ? { ...opts, autocontrast: false, contrast: 1 } : opts;
  const adjusted = adjust(flat, adjustOpts);
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
