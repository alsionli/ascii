import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

type SiliconFlowImageResponse = {
  images?: Array<{ url?: string }>;
  message?: string;
};

function detectImageContentType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error("SILICONFLOW_API_KEY is not configured");
      return jsonError(
        "Image generation is temporarily unavailable. Please try again later.",
        500
      );
    }

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return jsonError("A prompt is required", 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 110_000);

    let generatedResponse: Response;
    try {
      generatedResponse = await fetch(
        "https://api.siliconflow.cn/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model:
              process.env.SILICONFLOW_IMAGE_MODEL || "Kwai-Kolors/Kolors",
            prompt: `${prompt.slice(0, 500)}, centered composition, clearly recognizable subject, clean simple background, strong silhouette, high contrast`,
            negative_prompt:
              "text, caption, logo, watermark, cluttered background, cropped subject, low contrast, blurry",
            image_size: "1024x1024",
            num_inference_steps: 20,
            guidance_scale: 7.5,
          }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = (await generatedResponse.json()) as SiliconFlowImageResponse;
    if (!generatedResponse.ok) {
      console.error(
        "SiliconFlow image generation failed:",
        generatedResponse.status,
        payload.message
      );

      if (generatedResponse.status === 401) {
        return jsonError(
          "Image generation authentication failed. Please try again later.",
          401
        );
      }
      if (generatedResponse.status === 429) {
        return jsonError(
          "Rate limit reached. Wait a moment and try again.",
          429
        );
      }
      if (generatedResponse.status === 503 || generatedResponse.status === 504) {
        return jsonError(
          "The image model is busy. Wait a moment and try again.",
          503
        );
      }

      return jsonError(
        payload.message || "Failed to generate the source image.",
        generatedResponse.status
      );
    }

    const imageUrl = payload.images?.[0]?.url;
    if (!imageUrl) {
      return jsonError("The image model returned no image. Try again.", 502);
    }

    const imageResponse = await fetch(imageUrl, { cache: "no-store" });
    if (!imageResponse.ok) {
      console.error("Failed to download generated image:", imageResponse.status);
      return jsonError("Failed to load the generated image. Try again.", 502);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const upstreamContentType = imageResponse.headers.get("content-type");
    const detectedContentType = detectImageContentType(
      new Uint8Array(imageBuffer)
    );

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type":
          detectedContentType ||
          (upstreamContentType?.startsWith("image/")
            ? upstreamContentType
            : "image/jpeg"),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate the source image";
    console.error("API error:", message, err instanceof Error ? err.cause : "");

    if (err instanceof DOMException && err.name === "AbortError") {
      return jsonError("Image generation took too long. Please try again.", 504);
    }

    return jsonError(message, 500);
  }
}
