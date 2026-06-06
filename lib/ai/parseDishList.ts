// lib/ai/parseDishList.ts
// LLM output → raw dish names. Tries JSON first (incl. ```json fences),
// then falls back to line-by-line parsing of a bulleted/numbered list.
export function parseDishList(text: unknown): string[] {
  if (typeof text !== "string" || !text.trim()) return [];

  const fenced = text.replace(/```(?:json)?/gi, "").trim();

  // Try JSON array first.
  try {
    const parsed = JSON.parse(fenced);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // not JSON — fall through to line parsing
  }

  // Line-by-line: strip leading bullets / numbering.
  return fenced
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}
