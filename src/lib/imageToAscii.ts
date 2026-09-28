export type Density = "sparse" | "medium" | "dense";
export type Charset = "ascii" | "blocks" | "braille";
export type Style = "luminance" | "edge" | "hybrid";
export type BackgroundMode = "keep" | "clean";

const LUMINANCE_GRADIENTS: Record<Density, string> = {
  sparse: " .:-",
  medium: " .:-=+*#%@",
  dense:
    " .'`^\",:;Il!i><~+_-?][}{1)(|/\\tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
};

const BLOCK_GRADIENT = " ░▒▓█";

const EDGE_CHARS_ASCII = ["-", "/", "|", "\\"];
const EDGE_CHARS_BLOCKS = ["─", "╱", "│", "╲"];

const MAX_SAMPLE_WIDTH = 240;
const DEFAULT_WIDTH = 100;

export type PixelsToAsciiOptions = {
  width?: number;
  density?: Density;
  charset?: Charset;
  style?: Style;
  background?: BackgroundMode;
  autoContrast?: boolean;
  edgeThreshold?: number;
  invert?: boolean;
};

export type ImageToAsciiOptions = PixelsToAsciiOptions;

const CHAR_ASPECT = 0.5;

function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function buildGrayscale(
  data: Uint8ClampedArray,
  w: number,
  h: number
): Float32Array {
  const out = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = getLuminance(data[i], data[i + 1], data[i + 2]);
  }
  return out;
}

function percentile(histogram: Uint32Array, total: number, value: number) {
  const target = total * value;
  let count = 0;
  for (let i = 0; i < histogram.length; i++) {
    count += histogram[i];
    if (count >= target) return i;
  }
  return 255;
}

/** Stretch the useful 1–99% tonal range, matching photo-editor auto contrast. */
function normalizeContrast(gray: Float32Array): Float32Array {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    histogram[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
  }

  const low = percentile(histogram, gray.length, 0.01);
  const high = percentile(histogram, gray.length, 0.99);
  if (high - low < 12) return gray;

  const out = new Float32Array(gray.length);
  const scale = 255 / (high - low);
  for (let i = 0; i < gray.length; i++) {
    const stretched = (gray[i] - low) * scale;
    // A small S-curve keeps faces readable without crushing midtones.
    const normalized = Math.max(0, Math.min(255, stretched)) / 255;
    const contrasted = (normalized - 0.5) * 1.12 + 0.5;
    out[i] = Math.max(0, Math.min(255, contrasted * 255));
  }
  return out;
}

type BorderStats = { mean: number; deviation: number };

function getBorderStats(gray: Float32Array, w: number, h: number): BorderStats {
  const inset = Math.max(1, Math.round(Math.min(w, h) * 0.04));
  let sum = 0;
  let sumSquared = 0;
  let count = 0;

  for (let y = 0; y < h; y += inset) {
    for (let x = 0; x < w; x += inset) {
      if (x >= inset && x < w - inset && y >= inset && y < h - inset) {
        continue;
      }
      const value = gray[y * w + x];
      sum += value;
      sumSquared += value * value;
      count++;
    }
  }

  const mean = count ? sum / count : 255;
  const variance = count ? Math.max(0, sumSquared / count - mean * mean) : 0;
  return { mean, deviation: Math.sqrt(variance) };
}

type SobelResult = { mag: Float32Array; angle: Float32Array };

function sobel(gray: Float32Array, w: number, h: number): SobelResult {
  const mag = new Float32Array(w * h);
  const angle = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = gray[i - w - 1];
      const tc = gray[i - w];
      const tr = gray[i - w + 1];
      const ml = gray[i - 1];
      const mr = gray[i + 1];
      const bl = gray[i + w - 1];
      const bc = gray[i + w];
      const br = gray[i + w + 1];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      mag[i] = Math.hypot(gx, gy);
      angle[i] = Math.atan2(gy, gx);
    }
  }
  return { mag, angle };
}

function pickEdgeChar(angleRad: number, charset: Charset): string {
  const chars = charset === "ascii" ? EDGE_CHARS_ASCII : EDGE_CHARS_BLOCKS;
  let deg = (angleRad * 180) / Math.PI;
  deg = ((deg % 180) + 180) % 180;
  if (deg < 22.5 || deg >= 157.5) return chars[2];
  if (deg < 67.5) return chars[3];
  if (deg < 112.5) return chars[0];
  return chars[1];
}

function luminanceToChar(
  lum: number,
  gradient: string,
  invert: boolean
): string {
  const v = invert ? 255 - lum : lum;
  const idx = Math.min(
    Math.floor((v / 256) * gradient.length),
    gradient.length - 1
  );
  return gradient[idx];
}

function brailleForBlock(
  gray: Float32Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  bw: number,
  bh: number,
  threshold: number,
  invert: boolean
): string {
  const dotOffsets: [number, number, number][] = [
    [0, 0, 0x01],
    [0, 1, 0x02],
    [0, 2, 0x04],
    [1, 0, 0x08],
    [1, 1, 0x10],
    [1, 2, 0x20],
    [0, 3, 0x40],
    [1, 3, 0x80],
  ];
  let code = 0;
  for (const [dx, dy, mask] of dotOffsets) {
    const px = Math.min(w - 1, Math.floor(x0 + (dx + 0.5) * (bw / 2)));
    const py = Math.min(h - 1, Math.floor(y0 + (dy + 0.5) * (bh / 4)));
    const v = gray[py * w + px];
    const lit = invert ? v < 255 - threshold : v > threshold;
    if (lit) code |= mask;
  }
  if (code === 0) return " ";
  return String.fromCharCode(0x2800 + code);
}

export function pixelsToAscii(
  imageData: ImageData,
  options: PixelsToAsciiOptions = {}
): string {
  const {
    width = DEFAULT_WIDTH,
    density = "medium",
    charset = "ascii",
    style = "luminance",
    background = "keep",
    autoContrast = true,
    edgeThreshold = 80,
    invert = false,
  } = options;

  const { data, width: srcW, height: srcH } = imageData;
  const sourceGray = buildGrayscale(data, srcW, srcH);
  const gray = autoContrast ? normalizeContrast(sourceGray) : sourceGray;
  const border = getBorderStats(gray, srcW, srcH);
  const canCleanBackground = background === "clean" && border.deviation < 70;
  const backgroundTolerance = Math.max(
    16,
    Math.min(54, border.deviation * 1.6 + 10)
  );
  // A bright border usually means dark-on-light artwork, and vice versa.
  const effectiveInvert = canCleanBackground ? border.mean >= 128 : invert;

  const charAspect = charset === "braille" ? 0.5 : CHAR_ASPECT;
  const blockW = srcW / width;
  const blockH = blockW / charAspect;
  const rows = Math.max(1, Math.floor(srcH / blockH));

  let edges: SobelResult | null = null;
  if (style === "edge" || style === "hybrid") {
    edges = sobel(gray, srcW, srcH);
  }

  const lumGradient = LUMINANCE_GRADIENTS[density];
  const blockGradient = BLOCK_GRADIENT;
  const usingBlocks = charset === "blocks";
  const gradient = usingBlocks ? blockGradient : lumGradient;

  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    const yStart = Math.floor(row * blockH);
    const yEnd = Math.min(srcH, Math.floor((row + 1) * blockH));
    for (let col = 0; col < width; col++) {
      const xStart = Math.floor(col * blockW);
      const xEnd = Math.min(srcW, Math.floor((col + 1) * blockW));

      if (charset === "braille") {
        line += brailleForBlock(
          gray,
          srcW,
          srcH,
          xStart,
          yStart,
          xEnd - xStart,
          yEnd - yStart,
          edgeThreshold,
          effectiveInvert
        );
        continue;
      }

      let sumLum = 0;
      let sumMag = 0;
      let bestMag = 0;
      let bestAngle = 0;
      let count = 0;
      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const i = y * srcW + x;
          sumLum += gray[i];
          count++;
          if (edges) {
            const m = edges.mag[i];
            sumMag += m;
            if (m > bestMag) {
              bestMag = m;
              bestAngle = edges.angle[i];
            }
          }
        }
      }
      const avgLum = count ? sumLum / count : 0;
      const avgMag = count ? sumMag / count : 0;
      const isBackground =
        canCleanBackground &&
        Math.abs(avgLum - border.mean) <= backgroundTolerance &&
        avgMag < edgeThreshold * 0.55;

      if (style === "edge") {
        if (avgMag > edgeThreshold) {
          line += pickEdgeChar(bestAngle, usingBlocks ? "blocks" : "ascii");
        } else {
          line += " ";
        }
      } else if (style === "hybrid") {
        if (isBackground) {
          line += " ";
        } else if (bestMag > edgeThreshold * 2) {
          line += pickEdgeChar(bestAngle, usingBlocks ? "blocks" : "ascii");
        } else {
          line += luminanceToChar(avgLum, gradient, effectiveInvert);
        }
      } else {
        line += isBackground
          ? " "
          : luminanceToChar(avgLum, gradient, effectiveInvert);
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function sourceToImageData(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  naturalW: number,
  naturalH: number
): ImageData {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context not available");

  const aspect = naturalH / naturalW;
  const w = Math.min(naturalW, MAX_SAMPLE_WIDTH);
  const h = Math.max(1, Math.round(w * aspect));
  canvas.width = w;
  canvas.height = h;
  // Transparent PNG pixels otherwise read as black and turn into false detail.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export async function imageToAscii(
  source: File | HTMLImageElement,
  options: ImageToAsciiOptions = {}
): Promise<string> {
  let img: HTMLImageElement;
  if (source instanceof HTMLImageElement) {
    img = source;
  } else {
    if (!source.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }
    img = await loadImage(source);
  }
  const imageData = sourceToImageData(img, img.naturalWidth, img.naturalHeight);
  return pixelsToAscii(imageData, options);
}

export function videoFrameToAscii(
  video: HTMLVideoElement,
  options: ImageToAsciiOptions = {}
): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return "";
  const imageData = sourceToImageData(video, vw, vh);
  return pixelsToAscii(imageData, options);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
