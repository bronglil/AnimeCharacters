import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertPathOrbit,
  parallaxShiftCells,
  buildOrbitFrames,
} from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sajid = path.join(root, "samples/sajid/sajid.png");

describe("orbit / visible 3D", () => {
  it("parallax shifts near cells more than far", () => {
    const cells = [
      [
        { char: "A", r: 1, g: 2, b: 3 },
        { char: "B", r: 1, g: 2, b: 3 },
        { char: "C", r: 1, g: 2, b: 3 },
      ],
    ];
    const depth = [[0, 0.5, 1]];
    const shifted = parallaxShiftCells(cells, depth, 1);
    // Near cell at x=2 (depth 1) samples from x=1 → B
    assert.equal(shifted[0][2].char, "B");
    // Far cell at x=0 stays A
    assert.equal(shifted[0][0].char, "A");
  });

  it("buildOrbitFrames returns a full sine cycle", () => {
    const cells = Array.from({ length: 4 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => ({
        char: String(x),
        r: 200,
        g: 100,
        b: 80,
      })),
    );
    const depth = cells.map((row, y) =>
      row.map((_, x) => (x > 2 && x < 6 && y > 0 && y < 3 ? 0.9 : 0.1)),
    );
    const frames = buildOrbitFrames(cells, depth, { frames: 8, amplitude: 2 });
    assert.equal(frames.length, 8);
    assert.notEqual(frames[0].text, frames[2].text);
  });

  it("convertPathOrbit yields html viewer + png frames", async () => {
    const out = await convertPathOrbit(sajid, {
      style: "anime",
      quality: "fast",
      orbitFrames: 4,
      orbitAmplitude: 2.5,
      imageScale: 1,
    });
    assert.ok(out.html.includes("frames"));
    assert.equal(out.pngs.length, 4);
    assert.ok(out.depthGrid);
    assert.ok(Buffer.isBuffer(out.png));
  });
});
