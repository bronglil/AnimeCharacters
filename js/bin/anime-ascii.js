#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve, join, dirname, basename, extname } from "node:path";
import {
  convertPath,
  convertPathColored,
  RAMPS,
  LOOK_PRESETS,
  PORTRAIT_COLUMNS,
} from "../src/index.js";

function printHelp() {
  console.log(`Usage: anime-ascii <image> [options]

Looks:
  --look ascii            Readable glyphs · ${LOOK_PRESETS.ascii.columns} cols (default)
                          portrait → ${PORTRAIT_COLUMNS.ascii} cols
  --look dense            Finer mosaic · ${LOOK_PRESETS.dense.columns} cols
                          portrait → ${PORTRAIT_COLUMNS.dense} cols

Output formats (pick any combination):
  --format <list>         Comma list: text, html, ansi, png (pic), all
  --text                  Emit plain ASCII text
  --html                  Emit colored HTML
  --ansi / --color        Emit ANSI truecolor
  --png / --pic           Emit PNG image of the ASCII glyphs

  -o, --output <path>     Output file or basename
                          .png / .html / .txt / .ansi set format if --format omitted
                          With several formats, path is treated as a basename:
                            -o out --format text,html,png
                            → out.txt  out.html  out.png

Other:
  -w, --columns <n>       Override width
  -r, --ramp <name|chars> Ramp
      --style <mode>      auto | fill | relief | portrait | anime
      --quality <mode>    fast | high
      --image-scale <n>   PNG scale (default 2)
      --dither
      --list-ramps
  -h, --help

Examples:
  anime-ascii photo.png --format text
  anime-ascii photo.png --format html -o card.html
  anime-ascii photo.png --format png --style anime -o card.png
  anime-ascii photo.png --format text,html,png -o out
  anime-ascii photo.png --text --html --pic -o out
`);
}

function parseArgs(argv) {
  const args = {
    imagePath: null,
    output: null,
    columns: null,
    look: "ascii",
    ramp: null,
    cellAspect: null,
    invert: false,
    autocontrast: true,
    brightness: null,
    contrast: null,
    gamma: null,
    edgeBoost: null,
    dither: false,
    style: "auto",
    metric: "lstar",
    quality: "fast",
    formats: [],
    flags: { text: false, html: false, ansi: false, png: false },
    imageScale: 2,
    listRamps: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "--list-ramps":
        args.listRamps = true;
        break;
      case "-o":
      case "--output":
        args.output = next();
        break;
      case "-w":
      case "--columns":
        args.columns = Number(next());
        break;
      case "--look":
        args.look = next();
        break;
      case "-r":
      case "--ramp":
        args.ramp = next();
        break;
      case "--cell-aspect":
        args.cellAspect = Number(next());
        break;
      case "--invert":
        args.invert = true;
        break;
      case "--no-autocontrast":
        args.autocontrast = false;
        break;
      case "--brightness":
        args.brightness = Number(next());
        break;
      case "--contrast":
        args.contrast = Number(next());
        break;
      case "--gamma":
        args.gamma = Number(next());
        break;
      case "--edge-boost":
        args.edgeBoost = Number(next());
        break;
      case "--style":
        args.style = next();
        break;
      case "--metric":
        args.metric = next();
        break;
      case "--quality":
        args.quality = next();
        break;
      case "--format":
      case "--formats": {
        const list = String(next())
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        args.formats.push(...list);
        break;
      }
      case "--text":
        args.flags.text = true;
        break;
      case "--html":
        args.flags.html = true;
        break;
      case "--ansi":
      case "--color":
        args.flags.ansi = true;
        break;
      case "--png":
      case "--pic":
      case "--image":
        args.flags.png = true;
        break;
      case "--image-scale":
        args.imageScale = Number(next());
        break;
      case "--dither":
        args.dither = true;
        break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
        args.imagePath = a;
    }
  }
  return args;
}

function formatsFromOutputPath(output) {
  if (!output) return [];
  const ext = extname(output).toLowerCase();
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") return ["png"];
  if (ext === ".html" || ext === ".htm") return ["html"];
  if (ext === ".ansi") return ["ansi"];
  if (ext === ".txt" || ext === ".text" || ext === ".asc") return ["text"];
  return [];
}

function resolveCliFormats(args) {
  const fromFlags = [];
  if (args.flags.text) fromFlags.push("text");
  if (args.flags.html) fromFlags.push("html");
  if (args.flags.ansi) fromFlags.push("ansi");
  if (args.flags.png) fromFlags.push("png");

  const listed = [...args.formats, ...fromFlags];
  if (listed.length) return listed;

  const fromOut = formatsFromOutputPath(args.output);
  if (fromOut.length) return fromOut;

  return ["text"];
}

function buildOpts(args, formats) {
  const opts = {
    look: args.look === "dense" ? "dense" : "ascii",
    invert: args.invert,
    autocontrast: args.autocontrast,
    dither: args.dither,
    style: args.style,
    metric: args.metric,
    quality: args.quality,
    imageScale: args.imageScale,
    formats,
  };
  if (args.columns != null) opts.columns = args.columns;
  if (args.ramp != null) opts.ramp = args.ramp;
  if (args.cellAspect != null) opts.cellAspect = args.cellAspect;
  if (args.brightness != null) opts.brightness = args.brightness;
  if (args.contrast != null) opts.contrast = args.contrast;
  if (args.gamma != null) opts.gamma = args.gamma;
  if (args.edgeBoost != null) opts.edgeBoost = args.edgeBoost;
  return opts;
}

function outputPaths(output, formats) {
  /** @type {Record<string, string|null>} */
  const paths = { text: null, html: null, ansi: null, png: null };
  if (!output) return paths;

  const ext = extname(output).toLowerCase();
  const known = [".png", ".html", ".htm", ".txt", ".text", ".asc", ".ansi"];
  const multi = formats.length > 1 || !known.includes(ext);

  if (!multi && known.includes(ext)) {
    if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") paths.png = output;
    else if (ext === ".html" || ext === ".htm") paths.html = output;
    else if (ext === ".ansi") paths.ansi = output;
    else paths.text = output;
    return paths;
  }

  const dir = dirname(output);
  const base = basename(output, extname(output));
  const stem = join(dir === "." ? "" : dir, base);
  if (formats.includes("text")) paths.text = `${stem}.txt`;
  if (formats.includes("html")) paths.html = `${stem}.html`;
  if (formats.includes("ansi")) paths.ansi = `${stem}.ansi`;
  if (formats.includes("png")) paths.png = `${stem}.png`;
  return paths;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.listRamps) {
    for (const [name, chars] of Object.entries(RAMPS)) {
      console.log(`${name.padEnd(10)} ${JSON.stringify(chars)}`);
    }
    return 0;
  }
  if (!args.imagePath) {
    printHelp();
    return 1;
  }

  const formats = resolveCliFormats(args);
  const opts = buildOpts(args, formats);
  const needsRich =
    formats.includes("html") ||
    formats.includes("ansi") ||
    formats.includes("png") ||
    formats.includes("all");

  const paths = outputPaths(args.output, formats.includes("all")
    ? ["text", "html", "ansi", "png"]
    : formats);

  if (!needsRich && formats.length === 1 && formats[0] === "text") {
    const art = await convertPath(resolve(args.imagePath), opts);
    if (paths.text) writeFileSync(paths.text, art + "\n", "utf8");
    else console.log(art);
    return 0;
  }

  const rich = await convertPathColored(resolve(args.imagePath), opts);
  const wrote = [];

  if (rich.text != null) {
    if (paths.text) {
      writeFileSync(paths.text, rich.text + "\n", "utf8");
      wrote.push(paths.text);
    } else if (!args.output && formats.includes("text") && !formats.includes("ansi")) {
      console.log(rich.text);
    }
  }
  if (rich.html != null) {
    if (paths.html) {
      writeFileSync(paths.html, rich.html + "\n", "utf8");
      wrote.push(paths.html);
    } else if (!args.output && formats.includes("html") && formats.length === 1) {
      console.log(rich.html);
    }
  }
  if (rich.ansi != null) {
    if (paths.ansi) {
      writeFileSync(paths.ansi, rich.ansi + "\n", "utf8");
      wrote.push(paths.ansi);
    } else if (!args.output && (formats.includes("ansi") || (!formats.includes("text") && !formats.includes("html") && !formats.includes("png")))) {
      console.log(rich.ansi);
    } else if (!args.output && formats.includes("ansi") && !paths.text) {
      console.log(rich.ansi);
    }
  }
  if (rich.png != null) {
    if (paths.png) {
      writeFileSync(paths.png, rich.png);
      wrote.push(paths.png);
    } else if (!args.output) {
      throw new Error("PNG format needs -o path.png (or -o basename with --format png)");
    }
  }

  if (wrote.length) {
    console.error(`Wrote: ${wrote.join(", ")}`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
