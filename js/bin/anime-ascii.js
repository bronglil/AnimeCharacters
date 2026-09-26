#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertPath, convertPathColored, RAMPS, LOOK_PRESETS, PORTRAIT_COLUMNS } from "../src/index.js";

function printHelp() {
  console.log(`Usage: anime-ascii <image> [options]

Looks (presets — gallery / CLI / API share the same numbers):
  --look ascii            Readable glyphs · ${LOOK_PRESETS.ascii.columns} columns (default)
                          · portrait → ${PORTRAIT_COLUMNS.ascii} cols for face coverage
  --look dense            Near-photo mosaic · ${LOOK_PRESETS.dense.columns} columns
                          · portrait → ${PORTRAIT_COLUMNS.dense} cols

Options:
  -o, --output <file>     Write output (.html → colored HTML, else text/ANSI)
  -w, --columns <n>       Override preset column width
  -r, --ramp <name|chars> Ramp name or custom string
      --cell-aspect <f>   Character cell aspect ratio
      --invert            Invert luminance mapping
      --no-autocontrast   Disable percentile stretch
      --brightness <f>    Brightness offset
      --contrast <f>      Contrast multiplier
      --gamma <f>         Gamma
      --edge-boost <f>    Edge emphasis 0..1
      --style <mode>      auto | fill | relief | portrait | anime
                          anime = your face + cel outline polish (no morph)
      --metric <name>     lstar | average
      --quality <mode>    fast (default) | high
      --color             Emit ANSI truecolor (or HTML if -o *.html)
      --dither            Floyd-Steinberg dither
      --list-ramps        Print built-in ramps
  -h, --help              Show help

Examples:
  anime-ascii photo.png --look ascii --style anime --color
  anime-ascii photo.png --look ascii --style portrait --color
  anime-ascii sprite.png --look dense --color -o out.html
  anime-ascii photo.png -w 48 --color
`);
}

function parseArgs(argv) {
  const args = {
    image: null,
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
    color: false,
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
      case "--color":
        args.color = true;
        break;
      case "--dither":
        args.dither = true;
        break;
      default:
        if (a.startsWith("-")) {
          throw new Error(`Unknown option: ${a}`);
        }
        args.image = a;
    }
  }
  return args;
}

function buildOpts(args) {
  const opts = {
    look: args.look === "dense" ? "dense" : "ascii",
    invert: args.invert,
    autocontrast: args.autocontrast,
    dither: args.dither,
    style: args.style,
    metric: args.metric,
    quality: args.quality,
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
  if (!args.image) {
    printHelp();
    return 1;
  }

  const opts = buildOpts(args);

  if (args.color) {
    const rich = await convertPathColored(resolve(args.image), opts);
    if (args.output) {
      const out = String(args.output);
      if (out.endsWith(".html")) writeFileSync(out, rich.html + "\n", "utf8");
      else writeFileSync(out, rich.ansi + "\n", "utf8");
    } else {
      console.log(rich.ansi);
    }
  } else {
    const art = await convertPath(resolve(args.image), opts);
    if (args.output) writeFileSync(args.output, art + "\n", "utf8");
    else console.log(art);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
