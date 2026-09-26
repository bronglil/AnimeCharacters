/**
 * Convert 10 pokedex characters across design presets and assert usable ASCII.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { convertPath, convertPathColored, normalizeOptions } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const charDir = join(root, "samples", "characters");
const designsDir = join(charDir, "designs");
const catalogPath = join(charDir, "catalog.json");

const DESIGN_OPTS = {
  "classic-clean": {
    look: "ascii",
    style: "fill",
    quality: "high",
  },
  "classic-bold": {
    look: "ascii",
    style: "fill",
    quality: "high",
    localContrast: 0.48,
    contrast: 1.28,
  },
  "standard-soft": {
    look: "ascii",
    style: "fill",
    quality: "high",
    ramp: "standard",
    localContrast: 0.32,
    contrast: 1.1,
    edgeBoost: 0.35,
  },
  "dense-mosaic": {
    look: "dense",
    style: "fill",
    quality: "high",
  },
};

describe("look presets", () => {
  it("defaults to ascii look (~56 columns)", () => {
    const opts = normalizeOptions({});
    assert.equal(opts.look, "ascii");
    assert.equal(opts.columns, 56);
  });

  it("dense look uses ~72 columns", () => {
    const opts = normalizeOptions({ look: "dense" });
    assert.equal(opts.look, "dense");
    assert.equal(opts.columns, 72);
  });
});

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
        assert.ok(
          existsSync(join(designsDir, ch.designs[d.id].htmlFile)),
          `${ch.name} ${d.id} colored html`,
        );
      }
    }
  });

  it("converts every character with classic-clean into readable ASCII", async () => {
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    const pngs = readdirSync(charDir).filter((f) => f.endsWith(".png"));
    assert.equal(pngs.length, 10);
    for (const file of pngs) {
      const art = await convertPath(join(charDir, file), DESIGN_OPTS["classic-clean"]);
      const lines = art.split("\n");
      assert.ok(lines.length >= 12, `${file} too short`);
      assert.equal(lines[0].length, 56, `${file} width`);
      const spaces = (art.match(/ /g) || []).length;
      const ink = art.replace(/\s/g, "").length;
      assert.ok(spaces > 80, `${file} needs empty background space`);
      assert.ok(ink > 80, `${file} needs character ink`);
      const unique = new Set(art.replace(/\n/g, "")).size;
      assert.ok(unique >= 5, `${file} too few glyphs (${unique})`);
      const ch = catalog.characters.find((c) => c.image === file);
      assert.ok(ch, `catalog entry for ${file}`);
      assert.ok(
        existsSync(join(designsDir, ch.designs["classic-clean"].htmlFile)),
        `${file} colored html`,
      );
    }
  });

  it("supports all four design presets on pikachu", async () => {
    const pikachu = join(charDir, "025_pikachu.png");
    assert.ok(existsSync(pikachu));
    for (const [id, opts] of Object.entries(DESIGN_OPTS)) {
      const art = await convertPath(pikachu, opts);
      assert.ok(art.split("\n").length >= 12, id);
      assert.ok((art.match(/ /g) || []).length > 60, `${id} background`);
    }
  });

  it("emits glyph-forward colored HTML for pikachu", async () => {
    const rich = await convertPathColored(join(charDir, "025_pikachu.png"), DESIGN_OPTS["classic-clean"]);
    assert.ok(rich.html.includes("rgb("));
    assert.ok(rich.html.includes("ascii-color"));
    assert.ok(rich.html.includes("ascii-color--glyph"));
    assert.equal(rich.text.split("\n")[0].length, rich.cells[0].length);
  });
});
