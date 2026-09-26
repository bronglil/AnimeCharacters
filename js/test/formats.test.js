import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertPathColored,
  resolveFormats,
  toPng,
} from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pikachu = path.join(root, "samples/pikachu.png");

describe("output formats", () => {
  it("resolveFormats maps pic → png and all → four outputs", () => {
    assert.deepEqual([...resolveFormats({ formats: ["pic"] })].sort(), ["png"]);
    assert.deepEqual(
      [...resolveFormats({ formats: ["all"] })].sort(),
      ["ansi", "html", "png", "text"],
    );
  });

  it("library default returns text+html+ansi, not png", async () => {
    const rich = await convertPathColored(pikachu, { look: "ascii" });
    assert.ok(rich.text);
    assert.ok(rich.html);
    assert.ok(rich.ansi);
    assert.equal(rich.png, undefined);
  });

  it("formats: text only", async () => {
    const rich = await convertPathColored(pikachu, { formats: ["text"] });
    assert.ok(rich.text);
    assert.equal(rich.html, undefined);
    assert.equal(rich.png, undefined);
  });

  it("formats: html + png", async () => {
    const rich = await convertPathColored(pikachu, {
      formats: ["html", "png"],
      imageScale: 1,
    });
    assert.ok(rich.html.includes("ascii-color"));
    assert.ok(Buffer.isBuffer(rich.png));
    assert.ok(rich.png.length > 100);
    // PNG magic
    assert.equal(rich.png[0], 0x89);
    assert.equal(rich.png[1], 0x50);
  });

  it("toPng builds an image from cells", async () => {
    const rich = await convertPathColored(pikachu, { formats: ["text"] });
    const png = await toPng(rich.cells, { scale: 1 });
    assert.ok(png.length > 100);
  });
});
