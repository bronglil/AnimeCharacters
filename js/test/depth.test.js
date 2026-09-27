import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Jimp } from "jimp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeOptions,
  convertPathColored,
  convertImageColored,
  estimateDepthFromLuma,
  applyDepthToLuma,
  sampleDepthMap,
} from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sajid = path.join(root, "samples/sajid/sajid.png");

describe("depth options validation", () => {
  it("defaults to 2d", () => {
    const opts = normalizeOptions({});
    assert.equal(opts.dimension, "2d");
    assert.equal(opts.depthStrength, 0.55);
  });

  it("accepts depth dimension", () => {
    const opts = normalizeOptions({ dimension: "depth", depthStrength: 0.7 });
    assert.equal(opts.dimension, "depth");
    assert.equal(opts.depthStrength, 0.7);
  });

  it("rejects unknown dimension", () => {
    assert.throws(() => normalizeOptions({ dimension: "voxel" }), /Unknown dimension/);
  });

  it("rejects depthStrength out of range", () => {
    assert.throws(() => normalizeOptions({ depthStrength: -0.1 }), /depthStrength must be/);
    assert.throws(() => normalizeOptions({ depthStrength: 1.5 }), /depthStrength must be/);
  });
});

describe("estimateDepthFromLuma", () => {
  it("marks background far and blob center nearer", () => {
    const h = 21;
    const w = 21;
    const luma = Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => {
        const dx = x - 10;
        const dy = y - 10;
        return dx * dx + dy * dy <= 36 ? 0.4 : 0.98;
      }),
    );
    const depth = estimateDepthFromLuma(luma);
    assert.ok(depth[10][10] > depth[10][0]);
    assert.ok(depth[10][10] > 0.3);
    assert.equal(depth[0][0], 0);
  });
});

describe("applyDepthToLuma", () => {
  it("darkens near cells relative to far", () => {
    const luma = [
      [0.8, 0.8],
      [0.8, 0.8],
    ];
    const depth = [
      [1, 0],
      [0, 0],
    ];
    const out = applyDepthToLuma(luma, depth, 1);
    assert.ok(out[0][0] < out[0][1]);
  });

  it("strength 0 leaves luma unchanged", () => {
    const luma = [[0.5, 0.6]];
    const depth = [[1, 1]];
    const out = applyDepthToLuma(luma, depth, 0);
    assert.deepEqual(out, [[0.5, 0.6]]);
  });
});

describe("sampleDepthMap", () => {
  it("samples white as near", async () => {
    const img = new Jimp({ width: 4, height: 4, color: 0xffffffff });
    const grid = sampleDepthMap(img, 2, 2);
    assert.equal(grid.length, 2);
    assert.ok(grid[0][0] > 0.9);
  });
});

describe("dimension depth conversion", () => {
  it("2d default matches explicit 2d on sajid", async () => {
    const a = await convertPathColored(sajid, {
      look: "ascii",
      style: "anime",
      quality: "high",
      formats: ["text"],
    });
    const b = await convertPathColored(sajid, {
      look: "ascii",
      style: "anime",
      quality: "high",
      dimension: "2d",
      formats: ["text"],
    });
    assert.equal(a.text, b.text);
  });

  it("depth output differs from 2d on sajid", async () => {
    const flat = await convertPathColored(sajid, {
      look: "ascii",
      style: "anime",
      quality: "high",
      dimension: "2d",
      formats: ["text"],
    });
    const depth = await convertPathColored(sajid, {
      look: "ascii",
      style: "anime",
      quality: "high",
      dimension: "depth",
      depthStrength: 0.7,
      formats: ["text"],
    });
    assert.notEqual(flat.text, depth.text);
    assert.equal(depth.text.split("\n")[0].length, flat.text.split("\n")[0].length);
  });

  it("depth map path affects output", async () => {
    // Synthetic: dark subject on white + white-center depth map
    const photo = new Jimp({ width: 64, height: 64, color: 0xffffffff });
    for (let y = 16; y < 48; y++) {
      for (let x = 16; x < 48; x++) {
        photo.setPixelColor(0xff406080, x, y);
      }
    }
    const depthImg = new Jimp({ width: 64, height: 64, color: 0xff000000 });
    for (let y = 20; y < 44; y++) {
      for (let x = 20; x < 44; x++) {
        depthImg.setPixelColor(0xffffffff, x, y);
      }
    }

    const without = convertImageColored(photo, {
      look: "ascii",
      columns: 32,
      dimension: "depth",
      depthStrength: 1,
    });
    const withMap = convertImageColored(photo, {
      look: "ascii",
      columns: 32,
      dimension: "depth",
      depthStrength: 1,
      _depthImage: depthImg,
    });
    assert.notEqual(without.text, withMap.text);
  });
});
