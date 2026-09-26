/**
 * Render colored ASCII cells to a PNG buffer (image of the text).
 */
import { Jimp, loadFont } from "jimp";
import { SANS_8_WHITE, SANS_16_WHITE } from "jimp/fonts";

/** @typedef {{ char: string, r: number, g: number, b: number }} AsciiCell */

/** @type {Map<string, Promise<import("@jimp/plugin-print").BitmapFont>>} */
const fontPromises = new Map();

/** @type {Map<string, Uint8Array>} */
const maskCache = new Map();

/**
 * @param {"glyph"|"dense"} [variant]
 */
async function getFont(variant = "glyph") {
  const key = variant === "dense" ? "8" : "16";
  if (!fontPromises.has(key)) {
    fontPromises.set(
      key,
      loadFont(variant === "dense" ? SANS_8_WHITE : SANS_16_WHITE),
    );
  }
  return fontPromises.get(key);
}

function rgba(r, g, b, a = 255) {
  return (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0;
}

/**
 * @param {string} char
 * @param {Awaited<ReturnType<typeof getFont>>} font
 * @param {number} cellW
 * @param {number} cellH
 */
async function glyphMask(char, font, cellW, cellH) {
  const key = `${char.codePointAt(0)}:${cellW}x${cellH}:${font.common.lineHeight}`;
  if (maskCache.has(key)) return maskCache.get(key);

  const g = new Jimp({ width: cellW, height: cellH, color: 0x00000000 });
  if (char && char !== " ") {
    g.print({ font, x: 1, y: 0, text: char });
  }
  const mask = new Uint8Array(cellW * cellH);
  g.scan(0, 0, cellW, cellH, function (x, y, idx) {
    const data = this.bitmap.data;
    const a = data[idx + 3];
    const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    mask[y * cellW + x] = a > 8 || lum > 20 ? Math.max(a, lum) : 0;
  });
  maskCache.set(key, mask);
  return mask;
}

/**
 * @typedef {Object} PngRenderOptions
 * @property {"glyph"|"dense"} [variant="glyph"]
 * @property {number} [scale=2] integer upsample for sharper shares
 * @property {{ r: number, g: number, b: number }} [background]
 * @property {number} [pad=8]
 */

/**
 * Paint ASCII cells into a PNG.
 * @param {AsciiCell[][]} rows
 * @param {PngRenderOptions} [options]
 * @returns {Promise<Buffer>}
 */
export async function toPng(rows, options = {}) {
  if (!rows?.length || !rows[0]?.length) {
    throw new Error("anime-ascii: toPng needs a non-empty cell grid");
  }

  const variant = options.variant === "dense" ? "dense" : "glyph";
  const scale = Math.max(1, Math.min(8, Math.round(options.scale ?? 2)));
  const pad = Math.max(0, Math.round(options.pad ?? 8));
  const bg = options.background ?? { r: 7, g: 9, b: 14 };
  const font = await getFont(variant);

  const cellW = variant === "dense" ? 6 : 10;
  const cellH = font.common.lineHeight || (variant === "dense" ? 10 : 18);
  const cols = rows[0].length;
  const rowCount = rows.length;

  const width = pad * 2 + cols * cellW;
  const height = pad * 2 + rowCount * cellH;
  const img = new Jimp({
    width,
    height,
    color: rgba(bg.r, bg.g, bg.b, 255),
  });

  const unique = new Set();
  for (const row of rows) {
    for (const cell of row) {
      if (cell.char && cell.char !== " ") unique.add(cell.char);
    }
  }
  /** @type {Map<string, Uint8Array>} */
  const masks = new Map();
  await Promise.all(
    [...unique].map(async (ch) => {
      masks.set(ch, await glyphMask(ch, font, cellW, cellH));
    }),
  );

  for (let y = 0; y < rowCount; y++) {
    const row = rows[y];
    for (let x = 0; x < cols; x++) {
      const cell = row[x];
      if (!cell || cell.char === " ") continue;
      const mask = masks.get(cell.char);
      if (!mask) continue;
      const ox = pad + x * cellW;
      const oy = pad + y * cellH;
      const cr = Math.max(0, Math.min(255, Math.round(cell.r)));
      const cg = Math.max(0, Math.min(255, Math.round(cell.g)));
      const cb = Math.max(0, Math.min(255, Math.round(cell.b)));
      for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
          const ink = mask[py * cellW + px];
          if (!ink) continue;
          const a = Math.min(255, ink);
          img.setPixelColor(rgba(cr, cg, cb, a), ox + px, oy + py);
        }
      }
    }
  }

  const out =
    scale > 1
      ? img.resize({ w: width * scale, h: height * scale })
      : img;

  return out.getBuffer("image/png");
}
