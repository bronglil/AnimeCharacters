/**
 * Pseudo-3D depth from a simple 2D image.
 * Depth modulates glyph *density* only — never warps RGB / face layout.
 * Facial features (eyes / nose / brow) are preserved from the source luma.
 */

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * @param {boolean[][]} mask
 * @returns {number[][]}
 */
function interiorDistance(mask) {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const dist = Array.from({ length: h }, () => Array(w).fill(0));
  const INF = h + w + 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) {
        dist[y][x] = 0;
        continue;
      }
      let border = false;
      for (let dy = -1; dy <= 1 && !border; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= h || xx >= w || !mask[yy][xx]) {
            border = true;
            break;
          }
        }
      }
      dist[y][x] = border ? 0 : INF;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x] || dist[y][x] === 0) continue;
      if (y > 0) dist[y][x] = Math.min(dist[y][x], dist[y - 1][x] + 1);
      if (x > 0) dist[y][x] = Math.min(dist[y][x], dist[y][x - 1] + 1);
      if (y > 0 && x > 0) dist[y][x] = Math.min(dist[y][x], dist[y - 1][x - 1] + 1.414);
      if (y > 0 && x + 1 < w) dist[y][x] = Math.min(dist[y][x], dist[y - 1][x + 1] + 1.414);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      if (!mask[y][x] || dist[y][x] === 0) continue;
      if (y + 1 < h) dist[y][x] = Math.min(dist[y][x], dist[y + 1][x] + 1);
      if (x + 1 < w) dist[y][x] = Math.min(dist[y][x], dist[y][x + 1] + 1);
      if (y + 1 < h && x + 1 < w) dist[y][x] = Math.min(dist[y][x], dist[y + 1][x + 1] + 1.414);
      if (y + 1 < h && x > 0) dist[y][x] = Math.min(dist[y][x], dist[y + 1][x - 1] + 1.414);
    }
  }
  return dist;
}

/**
 * @param {number[][]} lumaGrid
 * @returns {number[][]}
 */
export function localContrastGrid(lumaGrid) {
  const h = lumaGrid.length;
  const w = lumaGrid[0]?.length ?? 0;
  const out = Array.from({ length: h }, () => Array(w).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 1;
      let max = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = Math.max(0, Math.min(h - 1, y + dy));
          const xx = Math.max(0, Math.min(w - 1, x + dx));
          const v = lumaGrid[yy][xx];
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      out[y][x] = clamp01(max - min);
    }
  }
  return out;
}

/**
 * Soft face depth prior from subject bbox — nose tip nearer, forehead softer,
 * eye sockets not flattened into one blob.
 * @param {boolean[][]} mask
 * @returns {{ prior: number[][], yMin: number, yMax: number, xMin: number, xMax: number }}
 */
function faceDepthPrior(mask) {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  let yMin = h;
  let yMax = 0;
  let xMin = w;
  let xMax = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
    }
  }
  const prior = Array.from({ length: h }, () => Array(w).fill(0));
  if (yMax <= yMin || xMax <= xMin) return { prior, yMin, yMax, xMin, xMax };

  const spanY = yMax - yMin;
  const spanX = xMax - xMin;
  const midX = (xMin + xMax) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;
      const ty = (y - yMin) / spanY; // 0 top … 1 bottom of bust
      const tx = (x - midX) / (spanX / 2 || 1); // -1…1
      const ax = Math.abs(tx);

      let d = 0.45;
      // Forehead — gentle forward plane, not max (keeps brow readable)
      if (ty < 0.28) d = 0.52 - ax * 0.08;
      // Eye / brow band — slightly recessed so sockets can stay darker from luma
      else if (ty < 0.42) d = 0.48 - ax * 0.05 + (ax > 0.15 && ax < 0.55 ? -0.06 : 0);
      // Nose bridge / tip — peak near center
      else if (ty < 0.58) {
        const nose = Math.exp(-((tx * 2.2) ** 2));
        d = 0.5 + 0.42 * nose - ax * 0.04;
      }
      // Mouth / chin
      else if (ty < 0.72) d = 0.55 - ax * 0.1;
      // Neck
      else if (ty < 0.82) d = 0.35;
      // Shoulders — farther
      else d = 0.22 + (1 - ax) * 0.08;

      prior[y][x] = clamp01(d);
    }
  }
  return { prior, yMin, yMax, xMin, xMax };
}

/**
 * Estimate per-cell depth from a luma grid (0 = far, 1 = near).
 *
 * @param {number[][]} lumaGrid  light≈1, dark≈0 (post-sample / post-style)
 * @returns {number[][]}
 */
export function estimateDepthFromLuma(lumaGrid) {
  const h = lumaGrid.length;
  const w = lumaGrid[0]?.length ?? 0;
  if (!h || !w) return [];

  const mask = lumaGrid.map((row) => row.map((v) => v < 0.92));
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (mask[y][x]) n++;
  }

  if (n < 4) {
    return Array.from({ length: h }, () => Array(w).fill(0));
  }

  const interior = interiorDistance(mask);
  let maxD = 1e-6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (interior[y][x] > maxD) maxD = interior[y][x];
    }
  }

  const contrast = localContrastGrid(lumaGrid);
  const { prior } = faceDepthPrior(mask);
  const depth = Array.from({ length: h }, () => Array(w).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) {
        depth[y][x] = 0;
        continue;
      }
      const interiorBias = interior[y][x] / maxD;
      const detailBias = contrast[y][x];
      const face = prior[y][x];
      // Face prior dominates volume; detail nudges features; interior softens silhouette
      const d =
        0.55 * clamp01(face) +
        0.25 * clamp01(interiorBias) +
        0.2 * clamp01(detailBias);
      depth[y][x] = clamp01(d);
    }
  }

  return depth;
}

/**
 * @param {{ bitmap: { width: number, height: number, data: Buffer|Uint8ClampedArray|number[] } }} image
 * @param {number} cols
 * @param {number} rows
 * @returns {number[][]}
 */
export function sampleDepthMap(image, cols, rows) {
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
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * srcW + x) << 2;
          sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          n++;
        }
      }
      row.push(n ? clamp01(sum / n) : 0);
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Merge depth into luma. Near → denser glyphs, but **keep eyes/nose/brow ink**
 * from the original luma so ASCII features stay readable.
 *
 * @param {number[][]} lumaGrid
 * @param {number[][]} depthGrid
 * @param {number} strength 0…1
 * @returns {number[][]}
 */
export function applyDepthToLuma(lumaGrid, depthGrid, strength) {
  const s = clamp01(Number(strength) || 0);
  if (s <= 0) return lumaGrid.map((row) => row.slice());

  const h = lumaGrid.length;
  const w = lumaGrid[0]?.length ?? 0;
  const contrast = localContrastGrid(lumaGrid);
  const out = Array.from({ length: h }, () => Array(w).fill(1));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const luma = lumaGrid[y][x];
      const d = depthGrid[y]?.[x] ?? 0;
      // Near darkens ink; far stays closer to original
      const target = luma * (0.4 + 0.6 * (1 - d));

      // Lock facial feature cells (eyes, nose edges, brows) to source luma
      const feature = clamp01(contrast[y][x] * 2.2);
      const darkFeature = luma < 0.5 ? clamp01((0.5 - luma) * 2) : 0;
      const preserve = clamp01(Math.max(feature, darkFeature * 0.85));

      const pull = s * (1 - 0.9 * preserve);
      let v = luma * (1 - pull) + target * pull;

      // Eyes / nostrils: never lighten past original (keep dark glyph ink)
      if (darkFeature > 0.25 && feature > 0.15) {
        v = Math.min(v, luma);
      }
      // Highlight planes (forehead catch-light): don't crush to mud
      if (luma > 0.62 && feature < 0.2) {
        v = Math.max(v, luma * 0.72);
      }

      out[y][x] = clamp01(v);
    }
  }
  return out;
}
