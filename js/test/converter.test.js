import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Jimp } from "jimp";
import {
  convertImage,
  convertPath,
  getRamp,
  RAMPS,
  srgb8ToLstar,
} from "../src/index.js";

function meanDensity(art, ramp) {
  const chars = [...art.replace(/\n/g, "")];
  if (!chars.length) return 0;
  return (
    chars.reduce((s, ch) => s + ramp.indexOf(ch) / Math.max(ramp.length - 1, 1), 0) /
    chars.length
  );
}

describe("ramps", () => {
  it("orders classic light to dark", () => {
    const ramp = getRamp("classic");
    assert.equal(ramp.at(-1), "@");
    assert.ok(ramp[0] === " " || ramp[0] === ".");
  });
});

describe("luminance", () => {
  it("maps black and white to extremes", () => {
    assert.ok(srgb8ToLstar(0, 0, 0) < 0.02);
    assert.ok(srgb8ToLstar(255, 255, 255) > 0.98);
  });
});

describe("convertImage", () => {
  it("maps black denser than white without invert", async () => {
    const ramp = getRamp("classic");
    const black = new Jimp({ width: 64, height: 64, color: 0x000000ff });
    const white = new Jimp({ width: 64, height: 64, color: 0xffffffff });
    const darkArt = convertImage(black, {
      columns: 40,
      autocontrast: false,
      invert: false,
      edgeBoost: 0,
    });
    const lightArt = convertImage(white, {
      columns: 40,
      autocontrast: false,
      invert: false,
      edgeBoost: 0,
    });
    assert.ok(meanDensity(darkArt, ramp) > 0.7);
    assert.ok(meanDensity(lightArt, ramp) < 0.3);
  });

  it("keeps output width equal to columns", async () => {
    const img = new Jimp({ width: 100, height: 80, color: 0x808080ff });
    const art = convertImage(img, { columns: 50 });
    for (const line of art.split("\n")) {
      assert.equal(line.length, 50);
    }
  });

  it("renders a bust silhouette with dense center", async () => {
    const ramp = getRamp("classic");
    const img = new Jimp({ width: 320, height: 400, color: 0xfafafaff });
    // head
    for (let y = 30; y < 150; y++) {
      for (let x = 110; x < 210; x++) {
        const dx = x - 160;
        const dy = y - 90;
        if (dx * dx + dy * dy < 50 * 50) img.setPixelColor(0x141414ff, x, y);
      }
    }
    // neck
    for (let y = 140; y < 210; y++) {
      for (let x = 140; x < 180; x++) img.setPixelColor(0x141414ff, x, y);
    }
    // shoulders (filled trapezoid approx)
    for (let y = 210; y < 380; y++) {
      const t = (y - 210) / 170;
      const half = 40 + t * 100;
      for (let x = Math.round(160 - half); x < Math.round(160 + half); x++) {
        if (x >= 0 && x < 320) img.setPixelColor(0x141414ff, x, y);
      }
    }

    const art = convertImage(img, {
      columns: 70,
      invert: false,
      autocontrast: true,
      edgeBoost: 0.2,
    });
    const rows = art.split("\n");
    const h = rows.length;
    const w = rows[0].length;
    const dens = (x0, x1, y0, y1) => {
      let s = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          s += ramp.indexOf(rows[y][x]) / Math.max(ramp.length - 1, 1);
          n++;
        }
      }
      return s / n;
    };
    const center = dens(Math.floor(w / 3), Math.floor((2 * w) / 3), Math.floor(h / 4), Math.floor((3 * h) / 4));
    const corner = dens(0, Math.floor(w / 6), 0, Math.floor(h / 6));
    assert.ok(center > corner + 0.2, `center=${center} corner=${corner}`);
  });

  it("converts every built-in ramp", async () => {
    const img = new Jimp({ width: 80, height: 80, color: 0x333333ff });
    for (const name of Object.keys(RAMPS)) {
      const art = convertImage(img, { columns: 40, ramp: name });
      assert.ok(art.length > 0);
    }
  });

  it("reads from a saved file path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "anime-ascii-"));
    const path = join(dir, "sample.png");
    const img = new Jimp({ width: 40, height: 40, color: 0x222222ff });
    await img.write(path);
    const art = await convertPath(path, { columns: 20, edgeBoost: 0 });
    assert.equal(art.split("\n")[0].length, 20);
  });
});
