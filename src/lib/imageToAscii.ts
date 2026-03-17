const DENSITY_GRADIENTS: Record<string, string> = {
  sparse: " .:-",
  medium: " .:-=+*#%@",
  dense: " .'`^\",:;Il!i><~+_-?][}{1)(|/\\tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
};

const MAX_CANVAS_WIDTH = 200;
const DEFAULT_WIDTH = 80;
const DEFAULT_DENSITY = "medium";

function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export type ImageToAsciiOptions = {
  width?: number;
  density?: "sparse" | "medium" | "dense";
};

export async function imageToAscii(
  source: File | HTMLImageElement,
  options: ImageToAsciiOptions = {}
): Promise<string> {
  const { width = DEFAULT_WIDTH, density = DEFAULT_DENSITY } = options;
  const gradient = DENSITY_GRADIENTS[density] ?? DENSITY_GRADIENTS.medium;

  let img: HTMLImageElement;

  if (source instanceof HTMLImageElement) {
    img = source;
  } else {
    if (!source.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }
    img = await loadImage(source);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const aspect = img.height / img.width;
  const canvasWidth = Math.min(img.width, MAX_CANVAS_WIDTH);
  const canvasHeight = Math.round(canvasWidth * aspect);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const { data } = imageData;

  const blockWidth = canvasWidth / width;
  const blockHeight = blockWidth * (2 / 1);
  const rows = Math.floor(canvasHeight / blockHeight);

  const lines: string[] = [];

  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < width; col++) {
      const px = Math.floor(col * blockWidth);
      const py = Math.floor(row * blockHeight);
      const idx = (py * canvasWidth + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luminance = getLuminance(r, g, b);
      const charIndex = Math.min(
        Math.floor((luminance / 256) * gradient.length),
        gradient.length - 1
      );
      line += gradient[charIndex];
    }
    lines.push(line);
  }

  return lines.join("\n");
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
