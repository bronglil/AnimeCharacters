/**
 * Visible 3D from a flat image.
 * Default: full 360° yaw spin using depth as Z (perspective + z-buffer).
 * Optional: left↔right wiggle parallax (`mode: "wiggle"`).
 * Animated GIF is the shareable form of that motion.
 */

import { BitmapImage, GifCodec, GifFrame, GifUtil } from "gifwrap";
import { renderAsciiBitmap, toPng } from "./ascii_image.js";
import { toPlain } from "./color_emit.js";

/** @typedef {{ char: string, r: number, g: number, b: number }} AsciiCell */

const EMPTY = { char: " ", r: 20, g: 22, b: 28 };

/**
 * Shift cells horizontally by depth (near moves more) — wiggle mode.
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {number} offsetCols
 * @returns {AsciiCell[][]}
 */
export function parallaxShiftCells(cells, depthGrid, offsetCols) {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  const out = Array.from({ length: h }, () => Array.from({ length: w }, () => EMPTY));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = depthGrid?.[y]?.[x] ?? 0;
      const srcXf = x - offsetCols * d;
      const sx = Math.round(srcXf);
      if (sx >= 0 && sx < w) out[y][x] = cells[y][sx];
    }
  }
  return out;
}

/**
 * Rotate the depth relief around Y by `yaw` radians (0…2π = full turn).
 * Each glyph is a point (x, depth→z); perspective project + z-buffer.
 *
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {number} yaw  radians
 * @param {{ depthScale?: number, focal?: number, camDist?: number }} [opts]
 * @returns {AsciiCell[][]}
 */
export function rotateYawCells(cells, depthGrid, yaw, opts = {}) {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  const cx = (w - 1) / 2;
  const depthScale = Math.max(0.4, Math.min(Number(opts.depthScale) || 1.35, 3));
  const focal = Math.max(0.6, Math.min(Number(opts.focal) || 1.15, 2.5));
  const camDist = Math.max(1.2, Math.min(Number(opts.camDist) || 2.4, 5));

  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  /** @type {(AsciiCell & { _z: number })[][]} */
  const out = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ ...EMPTY, _z: -Infinity })),
  );

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = cells[y][x];
      if (!cell || cell.char === " ") continue;

      const d = depthGrid?.[y]?.[x] ?? 0;
      const xN = w > 1 ? (x - cx) / (w / 2) : 0;
      const zN = (d - 0.2) * depthScale;

      const X = xN * cos + zN * sin;
      const Z = -xN * sin + zN * cos;

      const denom = Z + camDist;
      if (denom < 0.35) continue;

      const persp = focal / denom;
      const sx = Math.round(cx + X * (w / 2) * persp);
      if (sx < 0 || sx >= w) continue;

      if (Z >= out[y][sx]._z) {
        out[y][sx] = { char: cell.char, r: cell.r, g: cell.g, b: cell.b, _z: Z };
      }
    }
  }

  return out.map((row) =>
    row.map(({ char, r, g, b }) => ({ char, r, g, b })),
  );
}

/**
 * Build orbit frames. Default mode is full 360° spin.
 *
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {{ frames?: number, amplitude?: number, mode?: "spin360"|"wiggle", depthScale?: number }} [opts]
 */
export function buildOrbitFrames(cells, depthGrid, opts = {}) {
  const mode = opts.mode === "wiggle" ? "wiggle" : "spin360";
  const frames = Math.max(4, Math.min(Math.round(opts.frames ?? 24), 72));
  const amplitude = Math.max(0.5, Math.min(Number(opts.amplitude) || 2.8, 8));
  const out = [];

  for (let i = 0; i < frames; i++) {
    const angle = (i / frames) * Math.PI * 2;
    let shifted;
    if (mode === "wiggle") {
      const offset = Math.sin(angle) * amplitude;
      shifted = parallaxShiftCells(cells, depthGrid, offset);
      out.push({ cells: shifted, text: toPlain(shifted), angle, offset, mode });
    } else {
      shifted = rotateYawCells(cells, depthGrid, angle, {
        depthScale: opts.depthScale,
      });
      out.push({ cells: shifted, text: toPlain(shifted), angle, offset: 0, mode });
    }
  }
  return out;
}

/**
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {{ frames?: number, amplitude?: number, mode?: "spin360"|"wiggle", variant?: "glyph"|"dense", scale?: number, depthScale?: number }} [opts]
 */
export async function renderOrbitPngs(cells, depthGrid, opts = {}) {
  const frames = buildOrbitFrames(cells, depthGrid, opts);
  const variant = opts.variant === "dense" ? "dense" : "glyph";
  const scale = opts.scale ?? 1;
  const pngs = [];
  for (const frame of frames) {
    pngs.push(await toPng(frame.cells, { variant, scale }));
  }
  return { frames, pngs };
}

/**
 * Animated GIF of the depth orbit (360° spin or wiggle).
 *
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {{
 *   frames?: number,
 *   amplitude?: number,
 *   mode?: "spin360"|"wiggle",
 *   variant?: "glyph"|"dense",
 *   scale?: number,
 *   depthScale?: number,
 *   fps?: number,
 * }} [opts]
 * @returns {Promise<{ frames: ReturnType<typeof buildOrbitFrames>, gif: Buffer }>}
 */
export async function renderOrbitGif(cells, depthGrid, opts = {}) {
  const mode = opts.mode === "wiggle" ? "wiggle" : "spin360";
  const frames = buildOrbitFrames(cells, depthGrid, { ...opts, mode });
  const variant = opts.variant === "dense" ? "dense" : "glyph";
  const scale = opts.scale ?? 1;
  const fps = Math.max(4, Math.min(Math.round(opts.fps ?? (mode === "spin360" ? 14 : 12)), 30));
  const delayCentisecs = Math.max(2, Math.round(100 / fps));

  /** @type {import("gifwrap").GifFrame[]} */
  const gifFrames = [];
  for (const frame of frames) {
    const img = await renderAsciiBitmap(frame.cells, { variant, scale });
    const bitmap = new BitmapImage(img.bitmap);
    GifUtil.quantizeDekker(bitmap, 256);
    gifFrames.push(new GifFrame(bitmap, { delayCentisecs }));
  }

  const codec = new GifCodec();
  const gif = await codec.encodeGif(gifFrames, { loops: 0 });
  return { frames, gif: Buffer.from(gif.buffer) };
}

/**
 * HTML viewer for 360° spin (or wiggle).
 * @param {Buffer[]} [pngs]
 * @param {{ title?: string, fps?: number, frameUrls?: string[], mode?: string }} [opts]
 */
export function orbitViewerHtml(pngs = [], opts = {}) {
  const mode = opts.mode === "wiggle" ? "wiggle" : "spin360";
  const title =
    opts.title ||
    (mode === "spin360" ? "anime-ascii · 360° spin" : "anime-ascii · 3D wiggle");
  const fps = Math.max(4, Math.min(opts.fps ?? 14, 30));
  const dataUrls = opts.frameUrls?.length
    ? opts.frameUrls
    : pngs.map((buf) => `data:image/png;base64,${Buffer.from(buf).toString("base64")}`);
  const json = JSON.stringify(dataUrls);
  const blurb =
    mode === "spin360"
      ? "Full 360° yaw — depth relief rotates around Y (near pops forward)."
      : "Depth parallax wiggle — near glyphs move more than far ones.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0a0c0b; color: #d7e0d9;
      font-family: ui-monospace, Menlo, monospace;
    }
    .wrap { text-align: center; padding: 1.5rem; max-width: 96vw; }
    h1 { font-size: 1rem; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 0.5rem; }
    p { margin: 0 0 1rem; opacity: 0.7; font-size: 0.8rem; }
    img {
      max-width: min(92vw, 520px); height: auto;
      background: #000; border: 1px solid rgba(255,255,255,0.12);
    }
    .hint { margin-top: 0.85rem; font-size: 0.75rem; opacity: 0.55; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${title}</h1>
    <p>${blurb}</p>
    <img id="frame" alt="3D ASCII 360 spin" />
    <p class="hint">Autoplaying · ${dataUrls.length} frames · ${fps} fps · 360° loop · from a simple 2D photo</p>
  </div>
  <script>
    const frames = ${json};
    const img = document.getElementById("frame");
    let i = 0;
    img.src = frames[0];
    setInterval(() => {
      i = (i + 1) % frames.length;
      img.src = frames[i];
    }, ${Math.round(1000 / fps)});
  </script>
</body>
</html>
`;
}
