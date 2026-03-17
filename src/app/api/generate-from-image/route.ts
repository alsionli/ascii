import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { stripCodeFences, normalizeArt } from "@/lib/asciiUtils";

const IMAGE_PROMPT = `Convert this image to ASCII art. Output ONLY raw ASCII art — no markdown, no code fences, no backticks, no explanation, no titles.

RULES:
1. The art must be 20-30 lines tall and 40-70 characters wide.
2. Use only printable ASCII characters (codes 32-126).
3. Capture the main subject and composition of the image.
4. Use shading characters for depth: . : ; + = * # @ % &

Output ONLY the ASCII art, nothing else.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Add GEMINI_API_KEY to .env.local to enable AI enhancement." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json(
        { error: "An image is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = image.type || "image/jpeg";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      IMAGE_PROMPT,
    ]);

    const response = result.response;
    const text = response.text();

    if (!text) {
      return NextResponse.json(
        { error: "Model returned an empty response. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ascii: normalizeArt(stripCodeFences(text)),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate ASCII art";
    console.error("API error:", message, err instanceof Error ? err.cause : "");

    if (message.includes("API_KEY") || message.includes("API key")) {
      return NextResponse.json(
        { error: "Invalid API key. Check your GEMINI_API_KEY." },
        { status: 401 }
      );
    }
    if (message.includes("429") || message.includes("rate")) {
      return NextResponse.json(
        { error: "Rate limit reached. Wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
