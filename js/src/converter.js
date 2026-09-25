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
 * @property {number} [cellAspect=0.5]
 * @property {string} [ramp]
 * @property {boolean} [invert=false]
 * @property {boolean} [autocontrast=true]
 * @property {number} [brightness=0]
 * @property {number} [contrast=1]
 * @property {number} [gamma=1]
 * @property {number} [edgeBoost=0]
 * @property {boolean} [dither=false]
 * @property {"lstar"|"average"} [metric="lstar"]
 * @property {"fill"|"relief"|"auto"|"portrait"} [style="auto"]
 * @property {number} [reliefHollow=0.95]
 * @property {number} [reliefEdge=0.95]
 * @property {number} [reliefBase=0.8]
 * @property {number} [localContrast=0.45]
 * @property {"fast"|"high"} [quality="fast"]
 */

/** @returns {Required<AsciiOptions>} */
export function normalizeOptions(options = {}) {
  const style = options.style ?? "auto";
  const portraitDefaults =
    style === "portrait"
      ? { ramp: "classic", localContrast: 0.55, edgeBoost: 0.22, cellAspect: 0.48, contrast: 1.15 }
      : {};

  return {
    columns: options.columns ?? 80,
    cellAspect: options.cellAspect ?? portraitDefaults.cellAspect ?? 0.5,
    ramp: options.ramp ?? portraitDefaults.ramp ?? DEFAULT_RAMP,
    invert: Boolean(options.invert),
    autocontrast: options.autocontrast !== false,
    brightness: options.brightness ?? 0,
    contrast: options.contrast ?? portraitDefaults.contrast ?? 1,
    gamma: options.gamma ?? 1,
    edgeBoost: options.edgeBoost ?? portraitDefaults.edgeBoost ?? 0,
    dither: Boolean(options.dither),
    metric: options.metric === "average" ? "average" : "lstar",
    style,
    reliefHollow: options.reliefHollow ?? 0.95,
    reliefEdge: options.reliefEdge ?? 0.95,
    reliefBase: options.reliefBase ?? 0.8,
    localContrast: options.localContrast ?? portraitDefaults.localContrast ?? 0.45,
    quality: options.quality === "high" ? "high" : "fast",
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function pixelLuma(r, g, b, a, metric) {
  const alpha = a / 255;
  if (metric === "average") {
    return ((r + g + b) * alpha) / (255 * 3);
  }
  const bg = 128;
  const cr = r * alpha + bg * (1 - alpha);
  const cg = g * alpha + bg * (1 - alpha);
  const cb = b * alpha + bg * (1 - alpha);
  return srgb8ToLstar(cr, cg, cb);
}

/**
 * Downscale large images before sampling — big speed win, little quality loss.
 * `high` keeps ~4 samples per cell; `fast` ~2.
 */
function prepareForSampling(image, columns, cellAspect, quality) {
  const cols = Math.max(1, Math.min(Math.trunc(columns), 1000));
  const aspect = Math.max(0.2, Math.min(Number(cellAspect), 1.5));
  const rows = Math.max(1, Math.round((image.bitmap.height / image.bitmap.width) * cols * aspect));
  const scale = quality === "high" ? 4 : 2;
  const targetW = cols * scale;
  const targetH = rows * scale;

  if (image.bitmap.width <= targetW && image.bitmap.height <= targetH) {
    return { image, cols, rows };
  }

  const resized = image.clone().resize({ w: targetW, h: targetH });
  return { image: resized, cols, rows };
}

/** Area-average each ASCII cell from the (possibly downscaled) bitmap. */
function sampleLumaGrid(image, cols, rows, metric) {
  const srcW = image.bitmap.width;
  const srcH = image.bitmap.height;
  const { data } = image.bitmap;
  const grid = [];

  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor((cy * srcH) / rows);
    const y1 = Math.max(Math.floor(((cy + 1) * srcH) / rows), y0 + 1);
    const row = [];
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * srcW) / cols);
      const x1 = Math.max(Math.floor(((cx + 1) * srcW) / cols), x0 + 1);
      let sumLin = 0;
      let sumAvg = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (srcW * y + x) << 2;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (metric === "average") {
            sumAvg += pixelLuma(r, g, b, a, "average");
          } else {
            const alpha = a / 255;
            const bg = 128;
            const cr = (r * alpha + bg * (1 - alpha)) / 255;
            const cg = (g * alpha + bg * (1 - alpha)) / 255;
            const cb = (b * alpha + bg * (1 - alpha)) / 255;
            sumLin +=
              0.2126 * srgbToLinear(cr) +
              0.7152 * srgbToLinear(cg) +
              0.0722 * srgbToLinear(cb);
          }
          n++;
        }
      }
      if (!n) row.push(0.5);
      else if (metric === "average") row.push(sumAvg / n);
      else {
        const y = sumLin / n;
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

/** Width profile → find neck (narrowest band in upper half). */
function findNeckRel(mask, yMin, yMax) {
  const span = Math.max(yMax - yMin, 1);
  let bestRel = 0.45;
  let bestWidth = Infinity;
  for (let y = yMin; y <= yMax; y++) {
    const rel = (y - yMin) / span;
    if (rel < 0.28 || rel > 0.62) continue;
    let left = -1;
    let right = -1;
    for (let x = 0; x < mask[y].length; x++) {
      if (mask[y][x]) {
        if (left < 0) left = x;
        right = x;
      }
    }
    const width = right - left;
    if (width > 0 && width < bestWidth) {
      bestWidth = width;
      bestRel = rel;
    }
  }
  return bestRel;
}

/**
 * Anatomy-aware bust shading using the silhouette's own neck pinch.
 */
function applyRelief(lumaGrid, opts) {
  const h = lumaGrid.length;
  const w = lumaGrid[0]?.length ?? 0;
  const flat = lumaGrid.flat();
  const sorted = [...flat].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const hi = sorted[Math.floor(sorted.length * 0.95)] ?? 1;
  const thr = (lo + hi) / 2;

  const mask = lumaGrid.map((row) => row.map((v) => v < thr));
  const inkCount = mask.flat().filter(Boolean).length;
  if (inkCount < w * h * 0.05) return lumaGrid.map((row) => row.slice());

  const dist = distanceTransform(mask);
  let maxD = 1e-6;
  let yMin = h;
  let yMax = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      if (dist[y][x] > maxD) maxD = dist[y][x];
    }
  }
  const span = Math.max(yMax - yMin, 1);
  const neckRel = findNeckRel(mask, yMin, yMax);

  const out = Array.from({ length: h }, () => Array(w).fill(1));
  for (let y = 0; y < h; y++) {
    const rel = (y - yMin) / span;
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) {
        out[y][x] = 1;
        continue;
      }
      const d = dist[y][x] / maxD;
      const onEdge = d < 0.09;
      const nearEdge = d < 0.2;
      const inHead = rel < neckRel - 0.02;
      const inNeck = Math.abs(rel - neckRel) < 0.08;
      const inShoulders = rel > neckRel + 0.06;

      let density = 0.12;
      if (inHead) {
        // Egg head: heavier crown + jaw outline, hollow cheeks/face
        const jaw = rel > neckRel - 0.12;
        if (onEdge) density = jaw ? 0.68 : 0.78;
        else if (nearEdge) density = 0.4;
        else density = 0.05 + (1 - d) * 0.1;
        if (rel < 0.1 && nearEdge) density = Math.max(density, 0.85);
      } else if (inNeck) {
        density = onEdge || nearEdge ? 0.38 : 0.14;
      } else if (inShoulders) {
        const down = (rel - neckRel) / Math.max(1 - neckRel, 0.01);
        density = 0.72 + down * 0.28;
        if (onEdge) density = Math.max(density, 0.88);
      }

      density = clamp01(density + (((x * 13 + y * 29) % 7) - 3) * 0.01);
      out[y][x] = clamp01(1 - density);
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

/** Mix edges into tone so facial features / jawlines survive in photos. */
function applyPortraitEdges(grid, boost) {
  if (boost <= 0) return grid;
  const edges = edgeGridFromLuma(grid);
  const b = clamp01(boost);
  return grid.map((row, y) =>
    row.map((v, x) => {
      // Darken edges; lift flat midtones slightly so face planes read
      const e = edges[y][x];
      return clamp01(v * (1 - b * e) + 0.04 * b * (1 - e) * (v > 0.25 && v < 0.85 ? 1 : 0));
    }),
  );
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
  if (opts.autocontrast) data = percentileStretch(data, 4, 96);
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

  const prepared = prepareForSampling(image, opts.columns, opts.cellAspect, opts.quality);
  let grid = sampleLumaGrid(prepared.image, prepared.cols, prepared.rows, opts.metric);

  const useRelief =
    opts.style === "relief" || (opts.style === "auto" && isNearlyBinary(grid));
  const usePortrait = opts.style === "portrait" || (opts.style === "auto" && !useRelief);

  if (useRelief) {
    grid = applyRelief(grid, opts);
  } else {
    const contrastAmt = usePortrait ? Math.max(opts.localContrast, 0.45) : opts.localContrast;
    if (contrastAmt > 0) grid = applyLocalContrast(grid, contrastAmt);
    const edgeAmt = usePortrait ? Math.max(opts.edgeBoost, 0.18) : opts.edgeBoost;
    if (edgeAmt > 0) grid = applyPortraitEdges(grid, edgeAmt);
  }

  const flat = grid.flat();
  const adjustOpts = useRelief ? { ...opts, autocontrast: false, contrast: 1 } : opts;
  const adjusted = adjust(flat, adjustOpts);
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  let rebuilt = [];
  for (let y = 0; y < h; y++) rebuilt.push(adjusted.slice(y * w, (y + 1) * w));
  if (opts.dither) rebuilt = floydSteinberg(rebuilt, ramp.length);

  return rebuilt
    .map((row) => row.map((luma) => lumaToChar(luma, ramp, opts.invert)).join(""))
    .join("\n");
}

export async function convertPath(path, options = {}) {
  const image = await Jimp.read(path);
  return convertImage(image, options);
}

export async function convertBuffer(buffer, options = {}) {
  const image = await Jimp.read(buffer);
  return convertImage(image, options);
}
