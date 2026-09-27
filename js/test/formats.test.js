import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertPathColored,
  resolveFormats,
  toGif,
  toPng,
} from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pikachu = path.join(root, "samples/pikachu.png");

describe("output formats", () => {
  it("resolveFormats maps pic → png and all → five outputs", () => {
    assert.deepEqual([...resolveFormats({ formats: ["pic"] })].sort(), ["png"]);
    assert.deepEqual(
      [...resolveFormats({ formats: ["all"] })].sort(),
      ["ansi", "gif", "html", "png", "text"],
    );
  });

  it("library default returns text+html+ansi, not png/gif", async () => {
    const rich = await convertPathColored(pikachu, { look: "ascii" });
    assert.ok(rich.text);
    assert.ok(rich.html);
    assert.ok(rich.ansi);
    assert.equal(rich.png, undefined);
    assert.equal(rich.gif, undefined);
  });

  it("formats: text only", async () => {
    const rich = await convertPathColored(pikachu, { formats: ["text"] });
    assert.ok(rich.text);
    assert.equal(rich.html, undefined);
    assert.equal(rich.png, undefined);
    assert.equal(rich.gif, undefined);
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

  it("formats: gif", async () => {
    const rich = await convertPathColored(pikachu, {
      formats: ["gif"],
      imageScale: 1,
    });
    assert.ok(Buffer.isBuffer(rich.gif));
    assert.ok(rich.gif.length > 100);
    // GIF magic GIF87a / GIF89a
    assert.equal(rich.gif[0], 0x47);
    assert.equal(rich.gif[1], 0x49);
    assert.equal(rich.gif[2], 0x46);
  });

  it("toPng builds an image from cells", async () => {
    const rich = await convertPathColored(pikachu, { formats: ["text"] });
    const png = await toPng(rich.cells, { scale: 1 });
    assert.ok(png.length > 100);
  });

  it("toGif builds a GIF from cells", async () => {
    const rich = await convertPathColored(pikachu, { formats: ["text"] });
    const gif = await toGif(rich.cells, { scale: 1 });
    assert.ok(gif.length > 100);
    assert.equal(String.fromCharCode(gif[0], gif[1], gif[2]), "GIF");
  });
});
