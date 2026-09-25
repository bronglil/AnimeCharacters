/** Turn colored ASCII cells into HTML / ANSI strings. */

/**
 * @typedef {{ char: string, r: number, g: number, b: number }} AsciiCell
 */

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** @param {AsciiCell[][]} rows */
export function toHtml(rows, { monoSpaces = true } = {}) {
  const lines = rows.map((row) =>
    row
      .map(({ char, r, g, b }) => {
        const ch = char === " " && monoSpaces ? "&nbsp;" : escapeHtml(char);
        if (char === " " || (r > 248 && g > 248 && b > 248)) {
          return `<span class="bg">${ch}</span>`;
        }
        return `<span style="color:rgb(${clampByte(r)},${clampByte(g)},${clampByte(b)})">${ch}</span>`;
      })
      .join(""),
  );
  return `<div class="ascii-color">${lines.map((l) => `<div>${l}</div>`).join("")}</div>`;
}

/** @param {AsciiCell[][]} rows */
export function toAnsi(rows) {
  return rows
    .map((row) =>
      row
        .map(({ char, r, g, b }) => {
          if (char === " ") return " ";
          return `\x1b[38;2;${clampByte(r)};${clampByte(g)};${clampByte(b)}m${char}\x1b[0m`;
        })
        .join(""),
    )
    .join("\n");
}

/** @param {AsciiCell[][]} rows */
export function toPlain(rows) {
  return rows.map((row) => row.map((c) => c.char).join("")).join("\n");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
