/** Color / luminance helpers for accurate downsampling. */

export function srgbToLinear(c) {
  if (c <= 0.04045) return c / 12.92;
  return ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function lightnessLstar(y) {
  const yy = Math.max(0, Math.min(1, y));
  const f =
    yy <= (6 / 29) ** 3
      ? (yy * (29 / 6) ** 2) / 3 + 4 / 29
      : yy ** (1 / 3);
  return (116 * f - 16) / 100;
}

export function srgb8ToLstar(r, g, b) {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  return lightnessLstar(relativeLuminance(lr, lg, lb));
}

export function applyGamma(value, gamma) {
  const v = Math.max(0, Math.min(1, value));
  if (Math.abs(gamma - 1) < 1e-9) return v;
  return gamma > 0 ? v ** (1 / gamma) : v;
}

export function percentileStretch(values, lowP = 2, highP = 98) {
  if (!values.length) return values;
  const ordered = [...values].sort((a, b) => a - b);
  const n = ordered.length;

  const pct = (p) => {
    if (n === 1) return ordered[0];
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, n - 1);
    const t = idx - lo;
    return ordered[lo] * (1 - t) + ordered[hi] * t;
  };

  const loV = pct(lowP);
  const hiV = pct(highP);
  const span = hiV - loV;
  if (span < 1e-6) return values.map(() => 0.5);
  return values.map((v) => Math.max(0, Math.min(1, (v - loV) / span)));
}
