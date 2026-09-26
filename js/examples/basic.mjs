/**
 * Minimal consumer example — run from js/:
 *   node examples/basic.mjs ../samples/characters/025_pikachu.png
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertPathColored, LOOK_PRESETS } from "../src/index.js";

const input = resolve(process.argv[2] || "../samples/characters/025_pikachu.png");
const { html, text } = await convertPathColored(input, {
  look: "ascii",
  quality: "high",
  style: "fill",
});

const outHtml = resolve("examples/out-pikachu.html");
writeFileSync(
  outHtml,
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>anime-ascii example</title>
  <link rel="stylesheet" href="../src/ascii.css" />
</head>
<body style="margin:0;background:#07090e;padding:1.5rem">
${html}
</body>
</html>
`,
  "utf8",
);

console.log(`look=ascii columns=${LOOK_PRESETS.ascii.columns}`);
console.log(`plain width=${text.split("\n")[0].length}`);
console.log(`wrote ${outHtml}`);
