import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertPathOrbit,
  convertPathColored,
  parallaxShiftCells,
  buildOrbitFrames,
  rotateYawCells,
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
    assert.equal(shifted[0][2].char, "B");
    assert.equal(shifted[0][0].char, "A");
  });

  it("rotateYawCells changes layout across 90°", () => {
    const cells = Array.from({ length: 5 }, () =>
      Array.from({ length: 9 }, (_, x) => ({
        char: x === 4 ? "@" : x === 2 || x === 6 ? "#" : ".",
        r: 180,
        g: 120,
        b: 90,
      })),
    );
    const depth = cells.map((row) => row.map((_, x) => (x === 4 ? 1 : 0.3)));
    const front = rotateYawCells(cells, depth, 0);
    const side = rotateYawCells(cells, depth, Math.PI / 2);
    assert.notEqual(toPlainish(front), toPlainish(side));
  });

  it("buildOrbitFrames spin360 covers a full turn", () => {
    const cells = Array.from({ length: 4 }, () =>
      Array.from({ length: 8 }, (_, x) => ({
        char: String(x),
        r: 200,
        g: 100,
        b: 80,
      })),
    );
    const depth = cells.map((row, y) =>
      row.map((_, x) => (x > 2 && x < 6 && y > 0 && y < 3 ? 0.9 : 0.2)),
    );
    const frames = buildOrbitFrames(cells, depth, { frames: 8, mode: "spin360" });
    assert.equal(frames.length, 8);
    assert.equal(frames[0].mode, "spin360");
    assert.ok(Math.abs(frames[4].angle - Math.PI) < 0.01);
    assert.notEqual(frames[0].text, frames[2].text);
  });

  it("convertPathOrbit yields 360 html + animated gif", async () => {
    const out = await convertPathOrbit(sajid, {
      style: "anime",
      quality: "fast",
      orbitFrames: 6,
      orbitMode: "spin360",
      imageScale: 1,
    });
    assert.equal(out.mode, "spin360");
    assert.ok(out.html.includes("360"));
    assert.equal(out.pngs.length, 6);
    assert.ok(out.depthGrid);
    assert.ok(Buffer.isBuffer(out.png));
    assert.ok(Buffer.isBuffer(out.gif));
    assert.equal(String.fromCharCode(out.gif[0], out.gif[1], out.gif[2]), "GIF");
  });

  it("--3d gif is animated (multi-frame)", async () => {
    const out = await convertPathColored(sajid, {
      style: "anime",
      dimension: "depth",
      formats: ["gif"],
      orbitFrames: 6,
      orbitMode: "spin360",
      imageScale: 1,
    });
    assert.ok(out.gif.length > 5000);
    // Animated GIFs are larger / have multiple image descriptors; static ones are smaller
    assert.ok(out.gif.includes(Buffer.from("NETSCAPE")) || out.gif.length > 20000);
  });
});

function toPlainish(cells) {
  return cells.map((row) => row.map((c) => c.char).join("")).join("\n");
}
