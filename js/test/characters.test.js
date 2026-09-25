/**
 * Convert 10 pokedex characters across design presets and assert usable ASCII.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { convertPath } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const charDir = join(root, "samples", "characters");
const designsDir = join(charDir, "designs");
const catalogPath = join(charDir, "catalog.json");

const DESIGN_OPTS = {
  "classic-clean": {
    columns: 72,
    style: "fill",
    ramp: "classic",
    quality: "high",
    cellAspect: 0.48,
    localContrast: 0.28,
    edgeBoost: 0.1,
    contrast: 1.12,
  },
  "classic-dense": {
    columns: 72,
    style: "fill",
    ramp: "classic",
    quality: "high",
    cellAspect: 0.48,
    localContrast: 0.4,
    edgeBoost: 0.18,
    contrast: 1.2,
  },
  "standard-soft": {
    columns: 72,
    style: "fill",
    ramp: "standard",
    quality: "high",
    cellAspect: 0.5,
    localContrast: 0.25,
    edgeBoost: 0.08,
    contrast: 1.05,
  },
  "dither-detail": {
    columns: 80,
    style: "fill",
    ramp: "classic",
    quality: "high",
    cellAspect: 0.5,
    localContrast: 0.3,
    edgeBoost: 0.1,
    dither: true,
  },
};

describe("character design cards", () => {
  it("has catalog with 10 characters and 4 designs", () => {
    assert.ok(existsSync(catalogPath), "catalog.json missing — run character build");
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    assert.equal(catalog.characters.length, 10);
    assert.equal(catalog.designs.length, 4);
    for (const ch of catalog.characters) {
      assert.ok(existsSync(join(charDir, ch.image)), ch.image);
      for (const d of catalog.designs) {
        assert.ok(ch.designs[d.id], `${ch.name} missing ${d.id}`);
        assert.ok(existsSync(join(designsDir, ch.designs[d.id].file)));
      }
    }
  });

  it("converts every character with classic-clean into readable ASCII", async () => {
    const pngs = readdirSync(charDir).filter((f) => f.endsWith(".png"));
    assert.equal(pngs.length, 10);
    for (const file of pngs) {
      const art = await convertPath(join(charDir, file), DESIGN_OPTS["classic-clean"]);
      const lines = art.split("\n");
      assert.ok(lines.length >= 20, `${file} too short`);
      assert.equal(lines[0].length, 72, `${file} width`);
      const spaces = (art.match(/ /g) || []).length;
      const ink = art.replace(/\s/g, "").length;
      assert.ok(spaces > 200, `${file} needs empty background space`);
      assert.ok(ink > 200, `${file} needs character ink`);
      // Not a solid block of one glyph
      const unique = new Set(art.replace(/\n/g, "")).size;
      assert.ok(unique >= 5, `${file} too few glyphs (${unique})`);
    }
  });

  it("supports all four design presets on pikachu", async () => {
    const pikachu = join(charDir, "025_pikachu.png");
    assert.ok(existsSync(pikachu));
    for (const [id, opts] of Object.entries(DESIGN_OPTS)) {
      const art = await convertPath(pikachu, opts);
      assert.ok(art.split("\n").length >= 20, id);
      assert.ok((art.match(/ /g) || []).length > 100, `${id} background`);
    }
  });
});
