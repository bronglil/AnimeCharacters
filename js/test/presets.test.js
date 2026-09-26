/**
 * Locked look-preset contracts — gallery, CLI, and API must stay in sync.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  LOOK_PRESETS,
  PORTRAIT_COLUMNS,
  normalizeOptions,
  convertPath,
  convertPathColored,
  convertImageColored,
} from "../src/index.js";
import { Jimp } from "jimp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pikachu = join(root, "samples", "characters", "025_pikachu.png");

describe("LOOK_PRESETS hard specs", () => {
  it("locks ascii at 56 columns with readable glyph tuning", () => {
    assert.equal(LOOK_PRESETS.ascii.columns, 56);
    assert.equal(LOOK_PRESETS.ascii.contrast, 1.15);
    assert.equal(LOOK_PRESETS.ascii.edgeBoost, 0.35);
    assert.ok(LOOK_PRESETS.ascii.ramp.includes("@"));
    assert.equal(LOOK_PRESETS.ascii.ramp[0], " ");
  });

  it("locks dense at 72 columns", () => {
    assert.equal(LOOK_PRESETS.dense.columns, 72);
    assert.equal(LOOK_PRESETS.dense.contrast, 1.0);
    assert.equal(LOOK_PRESETS.dense.edgeBoost, 0.4);
  });

  it("normalizeOptions applies ascii by default", () => {
    const opts = normalizeOptions({});
    assert.equal(opts.look, "ascii");
    assert.equal(opts.columns, LOOK_PRESETS.ascii.columns);
    assert.equal(opts.contrast, LOOK_PRESETS.ascii.contrast);
    assert.equal(opts.edgeBoost, LOOK_PRESETS.ascii.edgeBoost);
    assert.equal(opts.ramp, LOOK_PRESETS.ascii.ramp);
  });

  it("normalizeOptions applies dense look", () => {
    const opts = normalizeOptions({ look: "dense" });
    assert.equal(opts.columns, LOOK_PRESETS.dense.columns);
    assert.equal(opts.contrast, LOOK_PRESETS.dense.contrast);
    assert.equal(opts.edgeBoost, LOOK_PRESETS.dense.edgeBoost);
  });

  it("portrait widens columns for accurate face coverage", () => {
    const asciiP = normalizeOptions({ look: "ascii", style: "portrait" });
    const denseP = normalizeOptions({ look: "dense", style: "portrait" });
    assert.equal(asciiP.columns, PORTRAIT_COLUMNS.ascii);
    assert.equal(denseP.columns, PORTRAIT_COLUMNS.dense);
    assert.ok(asciiP.columns > LOOK_PRESETS.ascii.columns);
    assert.equal(asciiP.edgeBoost, LOOK_PRESETS.ascii.edgeBoost);
  });

  it("explicit columns override preset width", () => {
    assert.equal(normalizeOptions({ look: "ascii", columns: 55 }).columns, 55);
    assert.equal(normalizeOptions({ look: "dense", columns: 80 }).columns, 80);
    assert.equal(
      normalizeOptions({ look: "ascii", style: "portrait", columns: 48 }).columns,
      48,
    );
  });
});

describe("preset output widths", () => {
  it("ascii look produces exactly 56 columns", async () => {
    assert.ok(existsSync(pikachu), "pikachu sample missing");
    const art = await convertPath(pikachu, { look: "ascii", style: "fill", quality: "high" });
    const width = art.split("\n")[0].length;
    assert.equal(width, LOOK_PRESETS.ascii.columns);
  });

  it("dense look produces exactly 72 columns", async () => {
    const art = await convertPath(pikachu, { look: "dense", style: "fill", quality: "high" });
    const width = art.split("\n")[0].length;
    assert.equal(width, LOOK_PRESETS.dense.columns);
    assert.ok(width > 65);
  });

  it("ascii colored HTML uses glyph class and rgb spans", async () => {
    const rich = await convertPathColored(pikachu, { look: "ascii", style: "fill" });
    assert.ok(rich.html.includes("ascii-color--glyph"));
    assert.ok(rich.html.includes("rgb("));
    assert.equal(rich.text.split("\n")[0].length, LOOK_PRESETS.ascii.columns);
  });

  it("dense colored HTML uses dense class", async () => {
    const rich = await convertPathColored(pikachu, { look: "dense", style: "fill" });
    assert.ok(rich.html.includes("ascii-color--dense"));
    assert.equal(rich.text.split("\n")[0].length, LOOK_PRESETS.dense.columns);
  });

  it("synthetic image respects look widths", () => {
    const img = new Jimp({ width: 120, height: 80, color: 0xffaa00ff });
    const ascii = convertImageColored(img, { look: "ascii", style: "fill" });
    const dense = convertImageColored(img, { look: "dense", style: "fill" });
    assert.equal(ascii.cells[0].length, LOOK_PRESETS.ascii.columns);
    assert.equal(dense.cells[0].length, LOOK_PRESETS.dense.columns);
  });
});
