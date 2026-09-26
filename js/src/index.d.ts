/**
 * Type definitions for anime-ascii (ESM, Node >= 18).
 */

export type LookPreset = "ascii" | "dense";
export type OutputFormat = "text" | "html" | "ansi" | "png" | "pic" | "all";

export interface LookPresetSpec {
  readonly columns: number;
  readonly contrast: number;
  readonly edgeBoost: number;
  readonly localContrast: number;
  readonly cellAspect: number;
  /** Glyph ramp light → dark */
  readonly ramp: string;
}

export declare const LOOK_PRESETS: {
  readonly ascii: LookPresetSpec;
  readonly dense: LookPresetSpec;
};

export declare const PORTRAIT_COLUMNS: {
  readonly ascii: number;
  readonly dense: number;
};

/** Inclusive column bounds enforced by `normalizeOptions`. */
export declare const MIN_COLUMNS: number;
export declare const MAX_COLUMNS: number;

export interface AsciiOptions {
  look?: LookPreset;
  columns?: number;
  cellAspect?: number;
  ramp?: string;
  invert?: boolean;
  autocontrast?: boolean;
  brightness?: number;
  contrast?: number;
  gamma?: number;
  edgeBoost?: number;
  dither?: boolean;
  metric?: "lstar" | "average";
  style?: "fill" | "relief" | "auto" | "portrait" | "anime";
  reliefHollow?: number;
  reliefEdge?: number;
  reliefBase?: number;
  localContrast?: number;
  quality?: "fast" | "high";
  background?: "auto" | "white" | "none";
  /** Choose outputs: text, html, ansi, png (pic). Library default = text+html+ansi (no png). */
  formats?: OutputFormat[];
  text?: boolean;
  html?: boolean;
  ansi?: boolean;
  png?: boolean;
  /** Alias of png */
  pic?: boolean;
  /** Deprecated alias of png */
  image?: boolean;
  /** PNG upsample factor 1–8 (default 2). */
  imageScale?: number;
}

export interface AsciiCell {
  char: string;
  r: number;
  g: number;
  b: number;
}

export interface ColoredAscii {
  cells: AsciiCell[][];
  /** Which formats were produced */
  formats?: string[];
  text?: string;
  html?: string;
  ansi?: string;
  /** PNG buffer when formats includes png/pic */
  png?: Buffer;
}

/** Alias for consumers who prefer this name. */
export type ConvertOptions = AsciiOptions;
/** Alias for colored conversion results. */
export type ConvertResult = ColoredAscii;

export declare const RAMPS: Record<string, string>;
export declare const DEFAULT_RAMP: string;
export declare function getRamp(nameOrChars: string): string;

export declare function normalizeOptions(options?: AsciiOptions): Required<
  Omit<
    AsciiOptions,
    | "image"
    | "imageScale"
    | "formats"
    | "text"
    | "html"
    | "ansi"
    | "png"
    | "pic"
  >
> &
  AsciiOptions;

export declare function resolveFormats(options?: AsciiOptions): Set<string>;
export declare function defaultFormats(hint?: {
  outputPath?: string | null;
  color?: boolean;
}): Set<string>;

export declare function convertImage(image: unknown, options?: AsciiOptions): string;
export declare function convertImageColored(image: unknown, options?: AsciiOptions): ColoredAscii;
export declare function convertPath(path: string, options?: AsciiOptions): Promise<string>;
export declare function convertPathColored(
  path: string,
  options?: AsciiOptions,
): Promise<ColoredAscii>;
export declare function convertBuffer(buffer: Buffer | ArrayBuffer, options?: AsciiOptions): Promise<string>;
export declare function convertBufferColored(
  buffer: Buffer | ArrayBuffer,
  options?: AsciiOptions,
): Promise<ColoredAscii>;

export declare function toHtml(
  rows: AsciiCell[][],
  options?: { monoSpaces?: boolean; variant?: "glyph" | "dense" },
): string;
export declare function toAnsi(rows: AsciiCell[][]): string;
export declare function toPlain(rows: AsciiCell[][]): string;

export declare function toPng(
  rows: AsciiCell[][],
  options?: {
    variant?: "glyph" | "dense";
    scale?: number;
    background?: { r: number; g: number; b: number };
    pad?: number;
  },
): Promise<Buffer>;

export declare function srgb8ToLstar(r: number, g: number, b: number): number;
export declare function srgbToLinear(c: number): number;
export declare function relativeLuminance(r: number, g: number, b: number): number;
export declare function lightnessLstar(r: number, g: number, b: number): number;
export declare function percentileStretch(
  values: number[],
  lowPct?: number,
  highPct?: number,
): number[];
