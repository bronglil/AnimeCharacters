#!/usr/bin/env node
/**
 * Rebuild ASCII designs (plain + colored HTML) for all characters.
 * Uses LOOK_PRESETS so gallery matches CLI / API output.
 * Usage: node scripts/build-character-designs.js
 */
import { readdirSync, mkdirSync, writeFileSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { convertPathColored, LOOK_PRESETS } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const charDir = join(root, "samples", "characters");
const outDir = join(charDir, "designs");
mkdirSync(outDir, { recursive: true });

const DESIGNS = [
  {
    id: "classic-clean",
    label: "Classic Clean",
    blurb: "Readable glyphs · color from image",
    opts: {
      look: "ascii",
      quality: "high",
      style: "fill",
    },
  },
  {
    id: "classic-bold",
    label: "Classic Bold",
    blurb: "Heavier ink · clear character shapes",
    opts: {
      look: "ascii",
      quality: "high",
      style: "fill",
      localContrast: 0.48,
      contrast: 1.28,
    },
  },
  {
    id: "standard-soft",
    label: "Standard Soft",
    blurb: "Softer ramp · colored glyphs",
    opts: {
      look: "ascii",
      quality: "high",
      style: "fill",
      ramp: "standard",
      localContrast: 0.32,
      contrast: 1.1,
      edgeBoost: 0.35,
    },
  },
  {
    id: "dense-mosaic",
    label: "Dense Mosaic",
    blurb: `Near-photo detail · ${LOOK_PRESETS.dense.columns} cols`,
    opts: {
      look: "dense",
      quality: "high",
      style: "fill",
    },
  },
];

const files = readdirSync(charDir).filter((f) => f.endsWith(".png"));
const catalog = {
  generatedAt: new Date().toISOString(),
  presets: LOOK_PRESETS,
  designs: DESIGNS.map(({ id, label, blurb }) => ({ id, label, blurb })),
  characters: [],
};

for (const file of files) {
  const m = file.match(/^(\d+)_(.+)\.png$/);
  const id = m[1];
  const name = m[2];
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  const charEntry = { id, name, title, image: file, designs: {} };
  process.stdout.write(`Converting ${title}...\n`);
  for (const design of DESIGNS) {
    const rich = await convertPathColored(join(charDir, file), design.opts);
    const base = `${id}_${name}__${design.id}`;
    writeFileSync(join(outDir, `${base}.txt`), rich.text + "\n", "utf8");
    writeFileSync(join(outDir, `${base}.html`), rich.html + "\n", "utf8");
    const lines = rich.text.split("\n");
    charEntry.designs[design.id] = {
      file: `${base}.txt`,
      htmlFile: `${base}.html`,
      columns: lines[0]?.length ?? 0,
      rows: lines.length,
      preview: lines.slice(0, 10).join("\n"),
    };
  }
  catalog.characters.push(charEntry);
}

catalog.characters.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(charDir, "catalog.json"), JSON.stringify(catalog, null, 2));
copyFileSync(join(charDir, "catalog.json"), join(root, "gallery", "catalog.json"));
console.log(`Done ${catalog.characters.length} chars × ${DESIGNS.length} designs (txt+html)`);
console.log(`Presets: ascii=${LOOK_PRESETS.ascii.columns}cols dense=${LOOK_PRESETS.dense.columns}cols`);
