#!/usr/bin/env node
/**
 * Rebuild ASCII designs for all characters in samples/characters.
 * Usage: node scripts/build-character-designs.js
 */
import { readdirSync, mkdirSync, writeFileSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { convertPath } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const charDir = join(root, "samples", "characters");
const outDir = join(charDir, "designs");
mkdirSync(outDir, { recursive: true });

const DESIGNS = [
  {
    id: "classic-clean",
    label: "Classic Clean",
    blurb: "Sharp silhouette, classic glyphs",
    opts: {
      columns: 72,
      style: "fill",
      ramp: "classic",
      quality: "high",
      cellAspect: 0.48,
      localContrast: 0.28,
      edgeBoost: 0.1,
      contrast: 1.12,
    },
  },
  {
    id: "classic-dense",
    label: "Classic Dense",
    blurb: "Heavier ink, stronger edges",
    opts: {
      columns: 72,
      style: "fill",
      ramp: "classic",
      quality: "high",
      cellAspect: 0.48,
      localContrast: 0.4,
      edgeBoost: 0.18,
      contrast: 1.2,
    },
  },
  {
    id: "standard-soft",
    label: "Standard Soft",
    blurb: "image-to-ascii ramp, softer tones",
    opts: {
      columns: 72,
      style: "fill",
      ramp: "standard",
      quality: "high",
      cellAspect: 0.5,
      localContrast: 0.25,
      edgeBoost: 0.08,
      contrast: 1.05,
    },
  },
  {
    id: "dither-detail",
    label: "Dither Detail",
    blurb: "Floyd–Steinberg for fine shading",
    opts: {
      columns: 80,
      style: "fill",
      ramp: "classic",
      quality: "high",
      cellAspect: 0.5,
      localContrast: 0.3,
      edgeBoost: 0.1,
      dither: true,
    },
  },
];

const files = readdirSync(charDir).filter((f) => f.endsWith(".png"));
const catalog = {
  generatedAt: new Date().toISOString(),
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
    const art = await convertPath(join(charDir, file), design.opts);
    const outName = `${id}_${name}__${design.id}.txt`;
    writeFileSync(join(outDir, outName), art + "\n", "utf8");
    const lines = art.split("\n");
    charEntry.designs[design.id] = {
      file: outName,
      columns: lines[0]?.length ?? 0,
      rows: lines.length,
      preview: lines.slice(0, 14).join("\n"),
    };
  }
  catalog.characters.push(charEntry);
}

catalog.characters.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(charDir, "catalog.json"), JSON.stringify(catalog, null, 2));
copyFileSync(join(charDir, "catalog.json"), join(root, "gallery", "catalog.json"));
console.log(`Done ${catalog.characters.length} chars × ${DESIGNS.length} designs`);
