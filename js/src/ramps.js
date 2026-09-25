/** Character ramps ordered light → dark (ink density). */

export const RAMPS = {
  // Same default palette as npm `image-to-ascii` / asciify-pixel
  standard: " .,:;i1tfLCG08@",
  classic: " .:-=+*#%@",
  soft: " .,:;ox%#@",
  compact: " .:oO@",
  blocks: " ░▒▓█",
  binary: " 01",
  dense:
    " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
};

export const DEFAULT_RAMP = "standard";

/** @param {string} nameOrChars */
export function getRamp(nameOrChars) {
  const key = String(nameOrChars || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(RAMPS, key)) {
    return RAMPS[key];
  }
  if (!nameOrChars) {
    throw new Error("Ramp must be a non-empty character string");
  }
  return nameOrChars;
}
