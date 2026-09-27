import { Jimp } from "jimp";
import {
  applyGamma,
  percentileStretch,
  srgb8ToLstar,
  srgbToLinear,
} from "./luminance.js";
import { DEFAULT_RAMP, getRamp } from "./ramps.js";
import { toAnsi, toHtml, toPlain } from "./color_emit.js";
import { toPng } from "./ascii_image.js";
import { defaultFormats, formatsWereSpecified, resolveFormats } from "./formats.js";
import {
  applyDepthToLuma,
  estimateDepthFromLuma,
  sampleDepthMap,
} from "./depth.js";

/**
 * @typedef {Object} AsciiOptions
 * @property {"ascii"|"dense"} [look="ascii"]
 *   ascii = readable glyphs (~56 cols; portraits use 64); dense = ~72 cols (portraits 80)
 * @property {number} [columns]
 * @property {number} [cellAspect]
 * @property {string} [ramp]
 * @property {boolean} [invert=false]
 * @property {boolean} [autocontrast=true]
 * @property {number} [brightness=0]
 * @property {number} [contrast]
 * @property {number} [gamma=1]
 * @property {number} [edgeBoost]
 * @property {boolean} [dither=false]
 * @property {"lstar"|"average"} [metric="lstar"]
 * @property {"fill"|"relief"|"auto"|"portrait"|"anime"} [style="auto"]
 *   anime = same face layout as portrait, with cel-outline polish (no face morph) * @property {number} [reliefHollow=0.95]
 * @property {number} [reliefEdge=0.95]
 * @property {number} [reliefBase=0.8]
 * @property {number} [localContrast]
 * @property {"fast"|"high"} [quality="fast"]
 * @property {"auto"|"white"|"none"} [background="auto"]
 *   auto = flatten transparent / edge-connected near-black to white (sprites)
 * @property {boolean} [image]
 *   Deprecated alias for png — prefer `formats: ["png"]` or `png: true`
 * @property {boolean} [png]
 * @property {boolean} [pic] alias of png
 * @property {boolean} [text]
 * @property {boolean} [html]
 * @property {boolean} [ansi]
 * @property {Array<"text"|"html"|"ansi"|"png"|"pic"|"all">} [formats]
 *   Choose outputs: text, html, ansi, png (pic). Default depends on CLI -o / --color.
 * @property {number} [imageScale=2]
 *   Upsample factor for the PNG (1–8)
 * @property {"2d"|"depth"} [dimension="2d"]
 *   depth = pseudo-3D from the image (glyph density only; no face morph)
 * @property {number} [depthStrength=0.55]
 *   How hard depth pulls ink (0–1); used when dimension is depth
 * @property {string} [depthMap]
 *   Optional grayscale depth image path (white=near); loaded by convertPath*
 * @property {import("jimp").Jimp} [_depthImage]
 *   Internal: preloaded depth map for convertImageCore
 */

/**
 * Locked look presets — gallery, CLI, and API all share these numbers.
 * Ramp strings are light → dark (space = empty, @ = densest ink).
 * ascii uses enough columns that portraits keep facial structure, still glyph-readable.
 * @type {Readonly<{ ascii: Readonly<Object>, dense: Readonly<Object> }>}
 */
export const LOOK_PRESETS = Object.freeze({
  ascii: Object.freeze({
    columns: 56,
    contrast: 1.15,
    edgeBoost: 0.35,
    localContrast: 0.45,
    cellAspect: 0.55,
    ramp: " .:-=+*#%@",
  }),
  dense: Object.freeze({
    columns: 72,
    contrast: 1.0,
    edgeBoost: 0.4,
    localContrast: 0.35,
    cellAspect: 0.5,
    ramp: " .:-=+*#%@",
  }),
});

/** Extra width when converting photos so faces aren't crushed into few lines. */
export const PORTRAIT_COLUMNS = Object.freeze({
  ascii: 64,
  dense: 80,
});

export const MIN_COLUMNS = 8;
export const MAX_COLUMNS = 400;

const STYLES = new Set(["auto", "fill", "relief", "portrait", "anime"]);
const QUALITIES = new Set(["fast", "high"]);
const BACKGROUNDS = new Set(["auto", "white", "none"]);
const DIMENSIONS = new Set(["2d", "depth"]);

/**
 * @param {unknown} value
 * @param {string} name
 * @param {number} [fallback]
 */
function requireFiniteNumber(value, name, fallback) {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${name} must be a finite number, got ${JSON.stringify(value)}`);
  }
  return n;
}

/**
 * @param {unknown} pathOrHint
 * @param {unknown} err
 */
function wrapImageError(pathOrHint, err) {
  const detail = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
  const isBuf =
    (typeof Buffer !== "undefined" && Buffer.isBuffer?.(pathOrHint)) ||
    pathOrHint instanceof ArrayBuffer;
  const where = typeof pathOrHint === "string" ? pathOrHint : isBuf ? "buffer" : "image";
  throw new Error(
    `anime-ascii: could not decode ${where}. Use a valid PNG/JPEG/GIF/WebP under a few hundred MB. (${detail})`,
  );
}

/** @returns {Required<AsciiOptions>} */
export function normalizeOptions(options = {}) {
  if (options == null || typeof options !== "object") {
    throw new Error("anime-ascii: options must be an object");
  }

  const lookRaw = options.look ?? "ascii";
  if (!(lookRaw in LOOK_PRESETS)) {
    throw new Error(
      `Unknown look preset "${lookRaw}". Use "ascii" (readable glyphs) or "dense" (finer mosaic).`,
    );
  }
  const look = /** @type {"ascii" | "dense"} */ (lookRaw);
  const lookDefaults = LOOK_PRESETS[look];

  const style = options.style ?? "auto";
  if (!STYLES.has(style)) {
    throw new Error(
      `Unknown style "${style}". Use auto | fill | relief | portrait | anime.`,
    );
  }
  const faceStyle = style === "portrait" || style === "anime";

  const quality = options.quality ?? "fast";
  if (!QUALITIES.has(quality)) {
    throw new Error(`Unknown quality "${quality}". Use "fast" or "high".`);
  }

  const background = options.background ?? "auto";
  if (!BACKGROUNDS.has(background)) {
    throw new Error(`Unknown background "${background}". Use auto | white | none.`);
  }

  const dimension = options.dimension ?? "2d";
  if (!DIMENSIONS.has(dimension)) {
    throw new Error(`Unknown dimension "${dimension}". Use "2d" or "depth".`);
  }

  let depthStrength = 0.55;
  if (options.depthStrength != null) {
    depthStrength = requireFiniteNumber(options.depthStrength, "depthStrength");
    if (depthStrength < 0 || depthStrength > 1) {
      throw new Error(`depthStrength must be 0–1, got ${depthStrength}`);
    }
  }

  // LOOK_PRESETS win for contrast / edges / ramp / cellAspect.
  // Portrait/anime may raise floors and widen columns for face coverage.
  const portraitFloor = faceStyle
    ? {
        localContrast: style === "anime" ? 0.55 : 0.5,
        edgeBoost: style === "anime" ? 0.42 : 0.28,
        cellAspect: 0.55,
      }
    : { localContrast: 0, edgeBoost: 0, cellAspect: 0 };

  const defaultColumns =
    options.columns != null
      ? requireFiniteNumber(options.columns, "columns")
      : faceStyle
        ? PORTRAIT_COLUMNS[look]
        : lookDefaults.columns;

  if (defaultColumns < MIN_COLUMNS || defaultColumns > MAX_COLUMNS) {
    throw new Error(
      `columns must be ${MIN_COLUMNS}–${MAX_COLUMNS}, got ${defaultColumns}`,
    );
  }

  return {
    look,
    columns: Math.round(defaultColumns),
    cellAspect: requireFiniteNumber(
      options.cellAspect ??
        Math.max(lookDefaults.cellAspect, portraitFloor.cellAspect || 0),
      "cellAspect",
    ),
    ramp: options.ramp ?? lookDefaults.ramp ?? DEFAULT_RAMP,
    invert: Boolean(options.invert),
    autocontrast: options.autocontrast !== false,
    brightness: requireFiniteNumber(options.brightness ?? 0, "brightness"),
    contrast: requireFiniteNumber(options.contrast ?? lookDefaults.contrast, "contrast"),
    gamma: requireFiniteNumber(options.gamma ?? 1, "gamma"),
    edgeBoost: requireFiniteNumber(
      options.edgeBoost ?? Math.max(lookDefaults.edgeBoost, portraitFloor.edgeBoost),
      "edgeBoost",
    ),
    dither: Boolean(options.dither),
    metric: options.metric === "average" ? "average" : "lstar",
    style,
    reliefHollow: requireFiniteNumber(options.reliefHollow ?? 0.95, "reliefHollow"),
    reliefEdge: requireFiniteNumber(options.reliefEdge ?? 0.95, "reliefEdge"),
    reliefBase: requireFiniteNumber(options.reliefBase ?? 0.8, "reliefBase"),
    localContrast: requireFiniteNumber(
      options.localContrast ??
        Math.max(lookDefaults.localContrast, portraitFloor.localContrast),
      "localContrast",
    ),
    quality,
    background,
    dimension,
    depthStrength,
    depthMap: typeof options.depthMap === "string" ? options.depthMap : undefined,
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

/** Area-average luma (+ optional RGB) for each ASCII cell.
 * @param {boolean} [preferSubject=false]
 *   When true, ignore pure background pixels inside a cell if any subject
 *   pixels exist — keeps thin features (ears, hair wisps) from washing out.
 */
function sampleGrids(image, cols, rows, metric, withColor, preferSubject = false) {
  const srcW = image.bitmap.width;
  const srcH = image.bitmap.height;
  const { data } = image.bitmap;
  const lumaGrid = [];
  const colorGrid = withColor ? [] : null;

  const isBgPx = (r, g, b, a) => {
    if (a < 8) return true;
    // Studio white / letterboxed black — not part of the subject
    if (r > 248 && g > 248 && b > 248) return true;
    if (r < 8 && g < 8 && b < 8) return true;
    return false;
  };

  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor((cy * srcH) / rows);
    const y1 = Math.max(Math.floor(((cy + 1) * srcH) / rows), y0 + 1);
    const lumaRow = [];
    const colorRow = withColor ? [] : null;
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * srcW) / cols);
      const x1 = Math.max(Math.floor(((cx + 1) * srcW) / cols), x0 + 1);

      let sumLin = 0;
      let sumAvg = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let n = 0;

      let sumLinSub = 0;
      let sumAvgSub = 0;
      let sumRSub = 0;
      let sumGSub = 0;
      let sumBSub = 0;
      let nSub = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (srcW * y + x) << 2;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const alpha = a / 255;
          const cr = r * alpha + 255 * (1 - alpha);
          const cg = g * alpha + 255 * (1 - alpha);
          const cb = b * alpha + 255 * (1 - alpha);
          const bg = isBgPx(cr, cg, cb, a);

          const addLin =
            metric === "average"
              ? null
              : 0.2126 * srgbToLinear(cr / 255) +
                0.7152 * srgbToLinear(cg / 255) +
                0.0722 * srgbToLinear(cb / 255);
          const addAvg = ((cr + cg + cb) * alpha) / (255 * 3);

          if (withColor) {
            sumR += cr;
            sumG += cg;
            sumB += cb;
          }
          if (metric === "average") sumAvg += addAvg;
          else sumLin += addLin;
          n++;

          if (!bg) {
            if (withColor) {
              sumRSub += cr;
              sumGSub += cg;
              sumBSub += cb;
            }
            if (metric === "average") sumAvgSub += addAvg;
            else sumLinSub += addLin;
            nSub++;
          }
        }
      }

      const useSub = preferSubject && nSub > 0;
      const nn = useSub ? nSub : n;
      const sLin = useSub ? sumLinSub : sumLin;
      const sAvg = useSub ? sumAvgSub : sumAvg;
      const sR = useSub ? sumRSub : sumR;
      const sG = useSub ? sumGSub : sumG;
      const sB = useSub ? sumBSub : sumB;

      if (!nn) {
        lumaRow.push(1); // empty / background → light
        if (withColor) colorRow.push({ r: 255, g: 255, b: 255 });
      } else if (metric === "average") {
        lumaRow.push(sAvg / nn);
        if (withColor) colorRow.push({ r: sR / nn, g: sG / nn, b: sB / nn });
      } else {
        const yLin = sLin / nn;
        const f =
          yLin <= (6 / 29) ** 3
            ? (yLin * (29 / 6) ** 2) / 3 + 4 / 29
            : yLin ** (1 / 3);
        lumaRow.push((116 * f - 16) / 100);
        if (withColor) colorRow.push({ r: sR / nn, g: sG / nn, b: sB / nn });
      }
    }
    lumaGrid.push(lumaRow);
    if (withColor) colorGrid.push(colorRow);
  }
  return { lumaGrid, colorGrid };
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

/**
 * Anime cel polish — keeps the same face layout, adds bold outline + soft skin planes.
 * Does not warp geometry or relocate features.
 */
function applyAnimeTouch(grid) {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (!h || !w) return grid;

  const edges = edgeGridFromLuma(grid);
  // Subject ≈ not near-white (after sampling, bg is ~1.0)
  const subject = grid.map((row) => row.map((v) => v < 0.92));

  // Outer silhouette ring (includes ears once subject-aware sampling kept them)
  const outline = Array.from({ length: h }, () => Array(w).fill(false));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!subject[y][x]) continue;
      let border = false;
      for (let dy = -1; dy <= 1 && !border; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= h || xx >= w || !subject[yy][xx]) {
            border = true;
            break;
          }
        }
      }
      outline[y][x] = border;
    }
  }

  // Reinforce left/right extrema in the head band so ear tips survive
  const y0 = Math.floor(h * 0.22);
  const y1 = Math.floor(h * 0.55);
  for (let y = y0; y < y1; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x++) {
      if (subject[y][x]) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0) {
      outline[y][left] = true;
      if (left + 1 < w && subject[y][left + 1]) outline[y][left + 1] = true;
    }
    if (right >= 0) {
      outline[y][right] = true;
      if (right - 1 >= 0 && subject[y][right - 1]) outline[y][right - 1] = true;
    }
  }

  const out = grid.map((row) => row.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!subject[y][x]) {
        out[y][x] = 1;
        continue;
      }
      let v = grid[y][x];
      const e = edges[y][x];

      // Soft cel bands on flat skin — skip strong edges so eyes / nose / brow survive in ASCII
      if (e < 0.28 && v > 0.35 && v < 0.88) {
        const bands = 5;
        const t = (v - 0.35) / (0.88 - 0.35);
        const q = Math.round(t * (bands - 1)) / (bands - 1);
        v = 0.35 + q * (0.88 - 0.35);
        v = grid[y][x] * 0.55 + v * 0.45;
      }

      // Ink-line silhouette (ears / hair / jaw)
      if (outline[y][x]) {
        v = Math.min(v, 0.18);
      } else if (e > 0.28) {
        // Stronger feature ink for eyes / nose / brow (readable in text + PNG)
        v = clamp01(v * (1 - 0.55 * e));
      } else if (v > 0.55 && v < 0.85) {
        v = clamp01(v + 0.03);
      }

      out[y][x] = clamp01(v);
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

/** Flatten transparent pixels and edge-connected near-black onto white. */
function flattenBackground(image, mode) {
  if (mode === "none") return image;
  const out = image.clone();
  const { width: W, height: H, data } = out.bitmap;

  // Always composite low-alpha onto white
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.999) {
      data[i] = Math.round(data[i] * a + 255 * (1 - a));
      data[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
      data[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
      data[i + 3] = 255;
    }
  }

  if (mode === "white" || mode === "auto") {
    const nearBlack = (i) => data[i] < 22 && data[i + 1] < 22 && data[i + 2] < 22;
    const cornerBlack =
      nearBlack(0) &&
      nearBlack(((W - 1) << 2)) &&
      nearBlack(((H - 1) * W) << 2) &&
      nearBlack((((H - 1) * W + (W - 1)) << 2));
    const mid = (((H >> 1) * W + (W >> 1)) << 2);
    const centerBlack = nearBlack(mid);
    // Knock out a dark stage only when corners are black but the subject isn't.
    const stage = mode === "white" || (cornerBlack && !centerBlack);

    if (stage) {
      const seen = new Uint8Array(W * H);
      const q = [];
      const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const id = y * W + x;
        if (seen[id]) return;
        if (!nearBlack(id << 2)) return;
        seen[id] = 1;
        q.push(id);
      };
      for (let x = 0; x < W; x++) {
        enqueue(x, 0);
        enqueue(x, H - 1);
      }
      for (let y = 0; y < H; y++) {
        enqueue(0, y);
        enqueue(W - 1, y);
      }
      for (let qi = 0; qi < q.length; qi++) {
        const id = q[qi];
        const x = id % W;
        const y = (id / W) | 0;
        const i = id << 2;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = 255;
        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
      }
    }
  }
  return out;
}

/**
 * Shared conversion pipeline.
 * @returns {{ text: string, html: string, ansi: string, cells: import('./color_emit.js').AsciiCell[][] }}
 */
function convertImageCore(image, options = {}) {
  const opts = normalizeOptions(options);
  const ramp = getRamp(opts.ramp);
  if (ramp.length < 2) throw new Error("Ramp needs at least 2 characters");

  const flatImg = flattenBackground(image, opts.background);
  const prepared = prepareForSampling(flatImg, opts.columns, opts.cellAspect, opts.quality);
  const useAnime = opts.style === "anime";
  const useReliefEarly = opts.style === "relief";
  // Prefer subject pixels so thin features (ears) aren't averaged into the background
  const preferSubject =
    useAnime || opts.style === "portrait" || opts.style === "auto" || opts.style === "fill";

  const { lumaGrid, colorGrid } = sampleGrids(
    prepared.image,
    prepared.cols,
    prepared.rows,
    opts.metric,
    true,
    preferSubject && !useReliefEarly,
  );
  let grid = lumaGrid;

  const useRelief =
    opts.style === "relief" || (opts.style === "auto" && isNearlyBinary(grid));
  const portraitLike =
    useAnime || opts.style === "portrait" || (opts.style === "auto" && !useRelief);

  if (useRelief) {
    grid = applyRelief(grid, opts);
  } else {
    const contrastAmt = portraitLike ? Math.max(opts.localContrast, 0.45) : opts.localContrast;
    if (contrastAmt > 0) grid = applyLocalContrast(grid, contrastAmt);
    const edgeAmt = portraitLike ? Math.max(opts.edgeBoost, 0.18) : opts.edgeBoost;
    if (edgeAmt > 0) grid = applyPortraitEdges(grid, edgeAmt);
    if (useAnime) grid = applyAnimeTouch(grid);
  }

  // Pseudo-3D: depth from the same image (or optional depth map) → glyph density only
  /** @type {number[][]|null} */
  let depthGrid = null;
  if (opts.dimension === "depth") {
    const h0 = grid.length;
    const w0 = grid[0]?.length ?? 0;
    if (options._depthImage) {
      depthGrid = sampleDepthMap(options._depthImage, w0, h0);
    } else {
      depthGrid = estimateDepthFromLuma(grid);
    }
    grid = applyDepthToLuma(grid, depthGrid, opts.depthStrength);
  }

  const flat = grid.flat();
  const adjustOpts = useRelief ? { ...opts, autocontrast: false, contrast: 1 } : opts;
  // Anime: gentler autocontrast so skin planes / ears stay
  const finalAdjust =
    useAnime ? { ...adjustOpts, contrast: Math.min(adjustOpts.contrast, 1.12) } : adjustOpts;
  const adjusted = adjust(flat, finalAdjust);
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  let rebuilt = [];
  for (let y = 0; y < h; y++) rebuilt.push(adjusted.slice(y * w, (y + 1) * w));
  if (opts.dither) rebuilt = floydSteinberg(rebuilt, ramp.length);

  const cells = rebuilt.map((row, y) =>
    row.map((luma, x) => {
      const char = lumaToChar(luma, ramp, opts.invert);
      const rgb = colorGrid[y][x];
      // Keep near-white background glyphs dim so color pop is on the subject
      if (char === " " || (rgb.r > 246 && rgb.g > 246 && rgb.b > 246)) {
        return { char: " ", r: 20, g: 22, b: 28 };
      }
      // Anime: slight chroma pop on mid skin (not face morph — color only)
      if (useAnime && char !== " " && rgb.r > 140 && rgb.g > 100 && rgb.b > 80 && rgb.r > rgb.b) {
        const pop = 1.06;
        return {
          char,
          r: Math.min(255, rgb.r * pop),
          g: Math.min(255, rgb.g * pop * 0.98),
          b: Math.min(255, rgb.b * 0.96),
        };
      }
      return { char, r: rgb.r, g: rgb.g, b: rgb.b };
    }),
  );

  return {
    text: toPlain(cells),
    html: toHtml(cells, { variant: opts.look === "dense" ? "dense" : "glyph" }),
    ansi: toAnsi(cells),
    cells,
    depthGrid,
  };
}

/**
 * Convert a Jimp image instance to plain ASCII art (string).
 * @param {import("jimp").Jimp} image
 * @param {AsciiOptions} [options]
 */
export function convertImage(image, options = {}) {
  return convertImageCore(image, options).text;
}

/**
 * Convert with color: plain text, HTML, and ANSI truecolor.
 * For PNG of the glyphs, use convertPathColored / convertBufferColored (or `toPng(cells)`).
 * @param {import("jimp").Jimp} image
 * @param {AsciiOptions} [options]
 */
export function convertImageColored(image, options = {}) {
  return convertImageCore(image, options);
}

/**
 * @param {{ text: string, html: string, ansi: string, cells: import('./color_emit.js').AsciiCell[][] }} result
 * @param {AsciiOptions} [options]
 * @param {{ outputPath?: string|null, color?: boolean }} [hint]
 */
async function applyOutputFormats(result, options = {}, hint = {}) {
  let formats;
  if (formatsWereSpecified(options)) {
    formats = resolveFormats(options);
  } else if (hint.fromCli) {
    formats = defaultFormats(hint);
  } else {
    // Library default: cheap outputs always; PNG only when asked
    formats = new Set(["text", "html", "ansi"]);
  }

  if (formats.size === 0) {
    throw new Error(
      'anime-ascii: no output formats selected. Use formats: ["text"|"html"|"ansi"|"png"].',
    );
  }

  /** @type {Record<string, unknown>} */
  const out = { cells: result.cells, formats: [...formats] };
  if (result.depthGrid) out.depthGrid = result.depthGrid;

  if (formats.has("text")) out.text = result.text;
  if (formats.has("html")) out.html = result.html;
  if (formats.has("ansi")) out.ansi = result.ansi;

  if (formats.has("png")) {
    const look = options.look === "dense" ? "dense" : "ascii";
    const scale = options.imageScale ?? 2;
    out.png = await toPng(result.cells, {
      variant: look === "dense" ? "dense" : "glyph",
      scale,
    });
  }

  return out;
}

/**
 * @param {AsciiOptions} [options]
 * @returns {Promise<AsciiOptions>}
 */
async function withDepthImage(options = {}) {
  if (options.dimension !== "depth" || !options.depthMap || options._depthImage) {
    return options;
  }
  try {
    const depthImage = await Jimp.read(options.depthMap);
    return { ...options, _depthImage: depthImage };
  } catch (err) {
    wrapImageError(options.depthMap, err);
  }
}

export async function convertPath(path, options = {}) {
  let image;
  try {
    image = await Jimp.read(path);
  } catch (err) {
    wrapImageError(path, err);
  }
  const opts = await withDepthImage(options);
  return convertImage(image, opts);
}

export async function convertPathColored(path, options = {}) {
  let image;
  try {
    image = await Jimp.read(path);
  } catch (err) {
    wrapImageError(path, err);
  }
  const opts = await withDepthImage(options);
  const base = convertImageColored(image, opts);
  return applyOutputFormats(base, opts, {
    color: opts.ansi === true || opts.formats?.includes?.("ansi"),
  });
}

export async function convertBuffer(buffer, options = {}) {
  let image;
  try {
    image = await Jimp.read(buffer);
  } catch (err) {
    wrapImageError(buffer, err);
  }
  const opts = await withDepthImage(options);
  return convertImage(image, opts);
}

export async function convertBufferColored(buffer, options = {}) {
  let image;
  try {
    image = await Jimp.read(buffer);
  } catch (err) {
    wrapImageError(buffer, err);
  }
  const opts = await withDepthImage(options);
  const base = convertImageColored(image, opts);
  return applyOutputFormats(base, opts, {
    color: opts.ansi === true || opts.formats?.includes?.("ansi"),
  });
}

/**
 * Visible 3D: depth-shaded ASCII + parallax orbit frames (time = 4th axis).
 * Open the returned `html` in a browser to see the wiggle.
 *
 * @param {string} path
 * @param {AsciiOptions & { orbitFrames?: number, orbitAmplitude?: number, orbitFps?: number }} [options]
 */
export async function convertPathOrbit(path, options = {}) {
  const { renderOrbitPngs, orbitViewerHtml } = await import("./orbit.js");
  const opts = await withDepthImage({
    ...options,
    dimension: "depth",
  });
  let image;
  try {
    image = await Jimp.read(path);
  } catch (err) {
    wrapImageError(path, err);
  }
  const base = convertImageColored(image, opts);
  if (!base.depthGrid) {
    throw new Error("anime-ascii: orbit requires a depth grid (dimension depth)");
  }
  const look = opts.look === "dense" ? "dense" : "ascii";
  const { frames, pngs } = await renderOrbitPngs(base.cells, base.depthGrid, {
    frames: options.orbitFrames ?? 16,
    amplitude: options.orbitAmplitude ?? 2.8,
    variant: look === "dense" ? "dense" : "glyph",
    scale: options.imageScale ?? 1,
  });
  const html = orbitViewerHtml(pngs, {
    title: options.orbitTitle || "anime-ascii · 3D wiggle",
    fps: options.orbitFps ?? 12,
    frameUrls: options.orbitFrameUrls,
  });
  return {
    cells: base.cells,
    depthGrid: base.depthGrid,
    text: base.text,
    html,
    png: pngs[0],
    pngs,
    frames,
    formats: ["html", "png"],
  };
}

export { toPng } from "./ascii_image.js";
export { resolveFormats, defaultFormats } from "./formats.js";
export {
  estimateDepthFromLuma,
  sampleDepthMap,
  applyDepthToLuma,
} from "./depth.js";
export {
  parallaxShiftCells,
  buildOrbitFrames,
  renderOrbitPngs,
  orbitViewerHtml,
} from "./orbit.js";
