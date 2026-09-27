/**
 * Type definitions for anime-ascii (ESM, Node >= 18).
 */

export type LookPreset = "ascii" | "dense";
export type OutputFormat = "text" | "html" | "ansi" | "png" | "pic" | "gif" | "all";
export type DimensionMode = "2d" | "depth";

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
  /** Choose outputs: text, html, ansi, png (pic), gif. Library default = text+html+ansi (no png/gif). */
  formats?: OutputFormat[];
  text?: boolean;
  html?: boolean;
  ansi?: boolean;
  png?: boolean;
  /** Alias of png */
  pic?: boolean;
  /** Deprecated alias of png */
  image?: boolean;
  /** GIF image of the ASCII glyphs (single-frame). */
  gif?: boolean;
  /** PNG/GIF upsample factor 1–8 (default 2). */
  imageScale?: number;
  /**
   * `2d` (default) = current flat conversion.
   * `depth` = pseudo-3D from the image — glyph density only, no face morph.
   */
  dimension?: DimensionMode;
  /** How strongly depth pulls ink (0–1). Default 0.55 when dimension is depth. */
  depthStrength?: number;
  /** Optional grayscale depth map path (white = near). Same framing as the photo. */
  depthMap?: string;
  /** Animated depth GIF mode when dimension is depth (default spin360). */
  orbitMode?: "spin360" | "wiggle";
  /** Animated GIF / orbit frame count (4–72). */
  orbitFrames?: number;
  /** Wiggle parallax strength in columns. */
  orbitAmplitude?: number;
  /** Animated GIF playback fps. */
  orbitFps?: number;
  orbitTitle?: string;
  orbitDepthScale?: number;
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
  /** GIF buffer when formats includes gif (animated when dimension is depth) */
  gif?: Buffer;
  /** Present when dimension is depth */
  depthGrid?: number[][];
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
    | "gif"
    | "depthMap"
  >
> &
  AsciiOptions;

export declare function estimateDepthFromLuma(lumaGrid: number[][]): number[][];
export declare function sampleDepthMap(
  image: { bitmap: { width: number; height: number; data: ArrayLike<number> } },
  cols: number,
  rows: number,
): number[][];
export declare function applyDepthToLuma(
  lumaGrid: number[][],
  depthGrid: number[][],
  strength: number,
): number[][];

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
): Promise<ConvertResult>;
export declare function convertBuffer(buffer: Buffer | ArrayBuffer, options?: AsciiOptions): Promise<string>;
export declare function convertBufferColored(
  buffer: Buffer | ArrayBuffer,
  options?: AsciiOptions,
): Promise<ConvertResult>;

/** Depth + 360° orbit (animated `gif`, PNG frames, HTML viewer). */
export declare function convertPathOrbit(
  path: string,
  options?: AsciiOptions,
): Promise<
  ConvertResult & {
    pngs: Buffer[];
    gif: Buffer;
    depthGrid: number[][];
    mode: "spin360" | "wiggle";
    frames: { cells: AsciiCell[][]; text: string; angle: number; offset: number; mode: string }[];
  }
>;

export declare function parallaxShiftCells(
  cells: AsciiCell[][],
  depthGrid: number[][],
  offsetCols: number,
): AsciiCell[][];
export declare function rotateYawCells(
  cells: AsciiCell[][],
  depthGrid: number[][],
  yaw: number,
  opts?: { depthScale?: number; focal?: number; camDist?: number },
): AsciiCell[][];
export declare function buildOrbitFrames(
  cells: AsciiCell[][],
  depthGrid: number[][],
  opts?: { frames?: number; amplitude?: number; mode?: "spin360" | "wiggle"; depthScale?: number },
): { cells: AsciiCell[][]; text: string; angle: number; offset: number; mode: string }[];
export declare function renderOrbitPngs(
  cells: AsciiCell[][],
  depthGrid: number[][],
  opts?: {
    frames?: number;
    amplitude?: number;
    mode?: "spin360" | "wiggle";
    variant?: "glyph" | "dense";
    scale?: number;
    depthScale?: number;
  },
): Promise<{
  frames: { cells: AsciiCell[][]; text: string; angle: number; offset: number; mode: string }[];
  pngs: Buffer[];
}>;
export declare function renderOrbitGif(
  cells: AsciiCell[][],
  depthGrid: number[][],
  opts?: {
    frames?: number;
    amplitude?: number;
    mode?: "spin360" | "wiggle";
    variant?: "glyph" | "dense";
    scale?: number;
    depthScale?: number;
    fps?: number;
  },
): Promise<{
  frames: { cells: AsciiCell[][]; text: string; angle: number; offset: number; mode: string }[];
  gif: Buffer;
}>;
export declare function orbitViewerHtml(
  pngs?: Buffer[],
  opts?: { title?: string; fps?: number; frameUrls?: string[]; mode?: string },
): string;

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

export declare function toGif(
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
