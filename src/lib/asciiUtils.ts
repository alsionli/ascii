export function stripCodeFences(text: string): string {
  return text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export function normalizeArt(raw: string): string {
  let lines = raw.split("\n");

  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  lines = lines.map((l) => l.trimEnd());

  if (lines.length < 2) return lines.join("\n");

  const centers: { idx: number; center: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const leading = lines[i].length - lines[i].trimStart().length;
    centers.push({ idx: i, center: leading + trimmed.length / 2 });
  }

  if (centers.length < 3) return lines.join("\n");

  const otherCenters = centers.slice(1).map((c) => c.center).sort((a, b) => a - b);
  const median = otherCenters[Math.floor(otherCenters.length / 2)];

  for (const { idx } of centers) {
    const trimmed = lines[idx].trim();
    const leading = lines[idx].length - lines[idx].trimStart().length;
    const curCenter = leading + trimmed.length / 2;
    if (Math.abs(curCenter - median) > 3) {
      const newLeading = Math.max(0, Math.round(median - trimmed.length / 2));
      lines[idx] = " ".repeat(newLeading) + trimmed;
    }
  }

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
