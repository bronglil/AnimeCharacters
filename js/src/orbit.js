/**
 * Visible 3D from a flat image: depth-based parallax over time (wiggle / orbit).
 * Static PNG alone cannot “look 3D”; animation is the 4th axis (time).
 */

import { toPng } from "./ascii_image.js";
import { toPlain } from "./color_emit.js";

/** @typedef {{ char: string, r: number, g: number, b: number }} AsciiCell */

const EMPTY = { char: " ", r: 20, g: 22, b: 28 };

/**
 * Shift cells horizontally by depth (near moves more).
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {number} offsetCols  signed shift amplitude in columns
 * @returns {AsciiCell[][]}
 */
export function parallaxShiftCells(cells, depthGrid, offsetCols) {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  const out = Array.from({ length: h }, () => Array(w).fill(null));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = depthGrid?.[y]?.[x] ?? 0;
      // Near (d→1) displaces more; far stays put
      const srcXf = x - offsetCols * d;
      let sx = Math.round(srcXf);
      if (sx < 0 || sx >= w) {
        out[y][x] = EMPTY;
      } else {
        out[y][x] = cells[y][sx];
      }
    }
  }
  return out;
}

/**
 * Build orbit / wiggle frame set from colored cells + depth.
 *
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {{ frames?: number, amplitude?: number }} [opts]
 * @returns {{ cells: AsciiCell[][], text: string, angle: number }[]}
 */
export function buildOrbitFrames(cells, depthGrid, opts = {}) {
  const frames = Math.max(2, Math.min(Math.round(opts.frames ?? 16), 48));
  const amplitude = Math.max(0.5, Math.min(Number(opts.amplitude) || 2.8, 8));
  const out = [];

  for (let i = 0; i < frames; i++) {
    // Full sine cycle → smooth left↔right wiggle (readable as 3D)
    const angle = (i / frames) * Math.PI * 2;
    const offset = Math.sin(angle) * amplitude;
    const shifted = parallaxShiftCells(cells, depthGrid, offset);
    out.push({
      cells: shifted,
      text: toPlain(shifted),
      angle,
      offset,
    });
  }
  return out;
}

/**
 * PNG buffers for each orbit frame.
 * @param {AsciiCell[][]} cells
 * @param {number[][]} depthGrid
 * @param {{ frames?: number, amplitude?: number, variant?: "glyph"|"dense", scale?: number }} [opts]
 */
export async function renderOrbitPngs(cells, depthGrid, opts = {}) {
  const frames = buildOrbitFrames(cells, depthGrid, opts);
  const variant = opts.variant === "dense" ? "dense" : "glyph";
  const scale = opts.scale ?? 1;
  const pngs = [];
  for (const frame of frames) {
    pngs.push(
      await toPng(frame.cells, {
        variant,
        scale,
      }),
    );
  }
  return { frames, pngs };
}

/**
 * HTML viewer — open in a browser to *see* the 3D wiggle.
 * Pass `pngs` (embedded) or `frameUrls` (relative paths, smaller repo).
 * @param {Buffer[]} [pngs]
 * @param {{ title?: string, fps?: number, frameUrls?: string[] }} [opts]
 */
export function orbitViewerHtml(pngs = [], opts = {}) {
  const title = opts.title || "anime-ascii · 3D wiggle";
  const fps = Math.max(4, Math.min(opts.fps ?? 12, 30));
  const dataUrls =
    opts.frameUrls?.length
      ? opts.frameUrls
      : pngs.map((buf) => `data:image/png;base64,${Buffer.from(buf).toString("base64")}`);
  const json = JSON.stringify(dataUrls);
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
    <p>Depth parallax over time — near glyphs move more than far ones. This is how you <em>see</em> 3D.</p>
    <img id="frame" alt="3D ASCII wiggle" />
    <p class="hint">Autoplaying · ${dataUrls.length} frames · ${fps} fps · from a simple 2D photo</p>
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
