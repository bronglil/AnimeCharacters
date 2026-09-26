/**
 * Real portrait fixture (Sajid) — locks look presets on a human photo.
 * Portrait mode must keep enough columns/rows to cover the face, not a tiny crop.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOOK_PRESETS,
  PORTRAIT_COLUMNS,
  convertPath,
  convertPathColored,
} from "../src/index.js";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sajid.png");

describe("sajid portrait fixture", () => {
  it("fixture exists", () => {
    assert.ok(existsSync(fixture), "test/fixtures/sajid.png missing");
  });

  it("ascii portrait → 64 cols and enough rows for a full bust", async () => {
    const art = await convertPath(fixture, {
      look: "ascii",
      style: "portrait",
      quality: "high",
    });
    const lines = art.split("\n");
    assert.equal(lines[0].length, PORTRAIT_COLUMNS.ascii);
    assert.ok(lines.length >= 40, `too few rows for portrait coverage: ${lines.length}`);
    const ink = art.replace(/\s/g, "").length;
    assert.ok(ink > 400, `expected dense character ink on portrait, got ${ink}`);
    const unique = new Set(art.replace(/\n/g, "")).size;
    assert.ok(unique >= 6, `too few glyph kinds: ${unique}`);
  });

  it("dense portrait → 80 cols", async () => {
    const art = await convertPath(fixture, {
      look: "dense",
      style: "portrait",
      quality: "high",
    });
    assert.equal(art.split("\n")[0].length, PORTRAIT_COLUMNS.dense);
    assert.ok(art.split("\n").length >= 45);
  });

  it("colored HTML uses glyph class + rgb", async () => {
    const rich = await convertPathColored(fixture, {
      look: "ascii",
      style: "portrait",
      quality: "high",
    });
    assert.ok(rich.html.includes("ascii-color--glyph"));
    assert.ok(rich.html.includes("rgb("));
    assert.equal(rich.text.split("\n")[0].length, PORTRAIT_COLUMNS.ascii);
  });

  it("fill look still uses base ascii width (sprites)", async () => {
    const art = await convertPath(fixture, {
      look: "ascii",
      style: "fill",
      quality: "high",
    });
    assert.equal(art.split("\n")[0].length, LOOK_PRESETS.ascii.columns);
  });

  it("anime style keeps portrait width and recognizable ink", async () => {
    const art = await convertPath(fixture, {
      look: "ascii",
      style: "anime",
      quality: "high",
    });
    const lines = art.split("\n");
    assert.equal(lines[0].length, PORTRAIT_COLUMNS.ascii);
    assert.ok(lines.length >= 40);
    const ink = art.replace(/\s/g, "").length;
    assert.ok(ink > 400);
  });
});
