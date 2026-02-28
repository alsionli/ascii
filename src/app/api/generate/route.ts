import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type Density = "sparse" | "medium" | "dense";

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
  return `You are an ASCII art generator. Output ONLY raw ASCII art — no markdown, no code fences, no backticks, no explanation, no titles.

RULES:
1. The art must be 20-30 lines tall and 40-70 characters wide.
2. Use only printable ASCII characters (codes 32-126).
3. The subject must be clearly recognizable with correct proportions.
4. Include the subject's most distinctive features so it is instantly identifiable.
5. Left-align all lines — do NOT add leading spaces for centering. The leftmost character of the art should start at column 0 on every line that has content.

SHADING (light to dark): . : ; + = * # @ % &
Outlines: / \\ | - _ ( ) < > [ ]
${DENSITY_INSTRUCTIONS[density]}`;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

function normalizeArt(raw: string): string {
  let lines = raw.split("\n");

  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  lines = lines.map((l) => l.trimEnd());

  if (lines.length < 2) return lines.join("\n");

  // Calculate center-of-content for each non-empty line
  const centers: { idx: number; center: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const leading = lines[i].length - lines[i].trimStart().length;
    centers.push({ idx: i, center: leading + trimmed.length / 2 });
  }

  if (centers.length < 3) return lines.join("\n");

  // Median center (skip first line to get the "intended" center)
  const otherCenters = centers.slice(1).map((c) => c.center).sort((a, b) => a - b);
  const median = otherCenters[Math.floor(otherCenters.length / 2)];

  // Fix lines whose center is far from median (typically just the first line)
  for (const { idx } of centers) {
    const trimmed = lines[idx].trim();
    const leading = lines[idx].length - lines[idx].trimStart().length;
    const curCenter = leading + trimmed.length / 2;
    if (Math.abs(curCenter - median) > 3) {
      const newLeading = Math.max(0, Math.round(median - trimmed.length / 2));
      lines[idx] = " ".repeat(newLeading) + trimmed;
    }
  }

  // Strip common indent
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const leading = line.match(/^ */)?.[0].length ?? 0;
    minIndent = Math.min(minIndent, leading);
  }
  if (isFinite(minIndent) && minIndent > 0) lines = lines.map((l) => l.slice(minIndent));

  const maxLen = Math.max(...lines.map((l) => l.length));
  lines = lines.map((l) => l.padEnd(maxLen));

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ARK_API_KEY is not configured. Add it to .env.local" },
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

    const client = new OpenAI({
      apiKey,
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      timeout: 30_000,
    });

    const systemPrompt = buildSystemPrompt(density as Density);
    const userPrompt = `Create ASCII art of: ${prompt.slice(0, 500)}\n\nMake it instantly recognizable. Output ONLY the ASCII art, nothing else.`;

    const completion = await client.chat.completions.create({
      model: process.env.ARK_MODEL || "deepseek-v3-2-251201",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "Model returned an empty response. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ascii: normalizeArt(stripCodeFences(text)) });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate ASCII art";
    console.error("API error:", message);

    if (message.includes("401") || message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Invalid API key. Check your ARK_API_KEY." },
        { status: 401 }
      );
    }
    if (message.includes("429") || message.includes("rate")) {
      return NextResponse.json(
        { error: "Rate limit reached. Wait a moment and try again." },
        { status: 429 }
      );
    }
    if (message.includes("timed out") || message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return NextResponse.json(
        { error: "Generation took too long. Try a simpler prompt." },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
