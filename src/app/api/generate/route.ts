import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type Density = "sparse" | "medium" | "dense";

const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DENSITY_INSTRUCTIONS: Record<Density, string> = {
  sparse: `
Style: Clean line-art with open whitespace.
- Use only structural characters: / \\ | - _ ( ) ' \` . :
- Leave large areas as blank space.
- Focus on crisp outlines and silhouettes.
- Minimal interior fill — let the shape breathe.`,
  medium: `
Style: Balanced detail with shading.
- Use structural characters for edges: / \\ | - _ ( ) [ ]
- Use a brightness gradient for shading: .  :  ;  =  +  *  #  @
  (. = lightest, @ = darkest)
- Fill interior regions with appropriate density.
- Create visible depth through lighter/darker zones.`,
  dense: `
Style: Maximum detail, photo-like density.
- Use the full ASCII gradient for shading:
  \` . - ' : _ , ; ! ~ + = ^ * ? / \\ | ( ) [ ] { } # % @ & $ W M
- Every character should contribute to shading or texture.
- Create smooth tonal gradients from highlights to shadows.
- Fill the entire bounding area — minimal blank space.
- Use character density to simulate light, shadow, and volume.`,
};

function buildSystemPrompt(density: Density): string {
  return `You are a world-class ASCII art artist. You produce museum-quality ASCII art.

RULES — follow these exactly:
1. Output ONLY raw ASCII art. No markdown, no code fences, no backticks, no explanation, no title, no labels.
2. The art must be 60-80 lines tall and 80-120 characters wide.
3. Every line must be the same width (pad with spaces on the right).
4. Use only printable ASCII characters (codes 32-126).
5. The subject must be clearly recognizable with accurate proportions and anatomy.

TECHNIQUE:
- Build the outline first with structural characters: / \\ | - _ ( ) < >
- Use character weight/density to create shading gradients.
- Lighter areas: . \` ' - : (fewer ink pixels per character)
- Darker areas: # @ & % W M $ (more ink pixels per character)
- Create depth with consistent light direction (top-left light source).
- Use contour lines that follow the 3D form of the subject.
- Add fine details: texture, patterns, subtle features.
${DENSITY_INSTRUCTIONS[density]}`;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

async function tryGenerate(
  genAI: GoogleGenerativeAI,
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const baseUrl = process.env.GEMINI_BASE_URL;
  const model = genAI.getGenerativeModel(
    { model: modelName, systemInstruction: systemPrompt },
    baseUrl ? { baseUrl } : undefined
  );
  const result = await model.generateContent(userPrompt);
  return stripCodeFences(result.response.text());
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GEMINI_API_KEY is not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const { prompt, density = "medium" } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A prompt is required" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = buildSystemPrompt(density as Density);
    const userPrompt = `Create a high-quality, detailed ASCII art of: ${prompt.slice(0, 500)}\n\nRemember: output ONLY the raw ASCII art, no code fences, no explanation.`;

    let lastError: unknown;
    for (let i = 0; i < MODELS.length; i++) {
      try {
        const ascii = await tryGenerate(genAI, MODELS[i], systemPrompt, userPrompt);
        return NextResponse.json({ ascii });
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : "";
        const isRetryable =
          msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests") ||
          msg.includes("400") || msg.includes("not supported") || msg.includes("not available") ||
          msg.includes("Bad Request");
        if (isRetryable) {
          if (i < MODELS.length - 1) await sleep(3000);
          continue;
        }
        throw err;
      }
    }

    const msg = lastError instanceof Error ? lastError.message : "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) {
      return NextResponse.json(
        { error: "Rate limit reached. Wait a minute and try again — Gemini free tier allows ~15 requests/min." },
        { status: 429 }
      );
    }
    if (msg.includes("not supported") || msg.includes("Bad Request")) {
      return NextResponse.json(
        { error: "Models unavailable in your region. Try using a VPN." },
        { status: 403 }
      );
    }
    throw lastError;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate ASCII art";
    console.error("Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
