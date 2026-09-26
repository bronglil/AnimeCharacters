/**
 * Resolve which artifacts to emit: text | html | ansi | png.
 * @param {import("./converter.js").AsciiOptions | Record<string, unknown>} [options]
 * @returns {Set<"text"|"html"|"ansi"|"png">}
 */
export function resolveFormats(options = {}) {
  const set = new Set();

  if (Array.isArray(options.formats)) {
    for (const raw of options.formats) {
      const f = String(raw).toLowerCase().trim();
      if (f === "pic" || f === "image" || f === "png") set.add("png");
      else if (f === "txt" || f === "text" || f === "plain") set.add("text");
      else if (f === "htm" || f === "html") set.add("html");
      else if (f === "ansi" || f === "color" || f === "terminal") set.add("ansi");
      else if (f === "all") {
        set.add("text");
        set.add("html");
        set.add("ansi");
        set.add("png");
      } else {
        throw new Error(
          `Unknown format "${raw}". Use text | html | ansi | png (pic) | all.`,
        );
      }
    }
  }

  // Boolean shorthands
  if (options.text === true) set.add("text");
  if (options.html === true) set.add("html");
  if (options.ansi === true) set.add("ansi");
  if (options.png === true || options.pic === true || options.image === true) set.add("png");

  // Explicit false removes (after adds from formats array)
  if (options.text === false) set.delete("text");
  if (options.html === false) set.delete("html");
  if (options.ansi === false) set.delete("ansi");
  if (options.png === false || options.pic === false || options.image === false) {
    set.delete("png");
  }

  return set;
}

/**
 * Default formats when the caller did not specify any.
 * @param {{ outputPath?: string|null, color?: boolean }} hint
 */
export function defaultFormats(hint = {}) {
  const out = hint.outputPath ? String(hint.outputPath).toLowerCase() : "";
  if (out.endsWith(".png") || out.endsWith(".jpg") || out.endsWith(".jpeg") || out.endsWith(".webp")) {
    return new Set(["png"]);
  }
  if (out.endsWith(".html") || out.endsWith(".htm")) {
    return new Set(["html"]);
  }
  if (out.endsWith(".ansi")) {
    return new Set(["ansi"]);
  }
  if (hint.color) {
    return new Set(["ansi"]);
  }
  return new Set(["text"]);
}

/**
 * @param {Set<string>} formats
 * @param {Record<string, unknown>} [options]
 */
export function formatsWereSpecified(options = {}) {
  if (Array.isArray(options.formats) && options.formats.length) return true;
  if (options.text === true || options.html === true || options.ansi === true) return true;
  if (options.png === true || options.pic === true || options.image === true) return true;
  if (options.text === false || options.html === false || options.ansi === false) return true;
  if (options.png === false || options.pic === false || options.image === false) return true;
  return false;
}
