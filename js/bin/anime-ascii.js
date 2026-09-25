#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertPath, RAMPS } from "../src/index.js";

function printHelp() {
  console.log(`Usage: anime-ascii <image> [options]

Options:
  -o, --output <file>     Write text to file
  -w, --columns <n>       Width in characters (default 80)
  -r, --ramp <name|chars> Ramp name or custom string (default classic)
      --cell-aspect <f>   Character width/height (default 0.5)
      --invert            Invert luminance mapping
      --no-autocontrast   Disable percentile stretch
      --brightness <f>    Brightness offset
      --contrast <f>      Contrast multiplier
      --gamma <f>         Gamma
      --edge-boost <f>    Edge emphasis 0..1
      --dither            Floyd-Steinberg dither
      --list-ramps        Print built-in ramps
  -h, --help              Show help
`);
}

function parseArgs(argv) {
  const args = {
    image: null,
    output: null,
    columns: 80,
    ramp: "classic",
    cellAspect: 0.5,
    invert: false,
    autocontrast: true,
    brightness: 0,
    contrast: 1,
    gamma: 1,
    edgeBoost: 0.15,
    dither: false,
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

  const art = await convertPath(resolve(args.image), {
    columns: args.columns,
    cellAspect: args.cellAspect,
    ramp: args.ramp,
    invert: args.invert,
    autocontrast: args.autocontrast,
    brightness: args.brightness,
    contrast: args.contrast,
    gamma: args.gamma,
    edgeBoost: args.edgeBoost,
    dither: args.dither,
  });

  if (args.output) {
    writeFileSync(args.output, art + "\n", "utf8");
  } else {
    console.log(art);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
