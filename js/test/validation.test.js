import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeOptions,
  convertPath,
  convertPathColored,
  MIN_COLUMNS,
  MAX_COLUMNS,
} from "../src/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("normalizeOptions validation", () => {
  it("rejects unknown look", () => {
    assert.throws(() => normalizeOptions({ look: "typo" }), /Unknown look preset/);
  });

  it("rejects columns out of range", () => {
    assert.throws(() => normalizeOptions({ columns: 0 }), /columns must be/);
    assert.throws(() => normalizeOptions({ columns: 10000 }), /columns must be/);
  });

  it("rejects unknown style and quality", () => {
    assert.throws(() => normalizeOptions({ style: "cartoon" }), /Unknown style/);
    assert.throws(() => normalizeOptions({ quality: "ultra" }), /Unknown quality/);
  });

  it("accepts bounds", () => {
    assert.equal(normalizeOptions({ columns: MIN_COLUMNS }).columns, MIN_COLUMNS);
    assert.equal(normalizeOptions({ columns: MAX_COLUMNS }).columns, MAX_COLUMNS);
  });
});

describe("image decode errors", () => {
  it("wraps broken path with actionable message", async () => {
    await assert.rejects(
      () => convertPath(path.join(root, "samples/general/does-not-exist.png")),
      /could not decode/,
    );
  });
});

describe("golden masters", () => {
  it("pikachu ascii text stays stable", async () => {
    const { text } = await convertPathColored(path.join(root, "samples/pikachu.png"), {
      look: "ascii",
      quality: "high",
    });
    const lines = text.split("\n");
    assert.equal(lines[0].length, 56);
    assert.ok(lines.length >= 20);
    // Shape smoke: non-empty ink somewhere in the middle band
    const mid = lines.slice(8, 20).join("");
    assert.match(mid, /[@#%*+=.-]/);
  });

  it("general landscape converts under ascii look", async () => {
    const text = await convertPath(path.join(root, "samples/general/landscape.png"), {
      look: "ascii",
    });
    assert.equal(text.split("\n")[0].length, 56);
  });
});
