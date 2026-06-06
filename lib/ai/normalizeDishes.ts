// lib/ai/normalizeDishes.ts
// Clean a raw dish list from any source into something safe to rank:
// trim, drop blanks, dedupe case-insensitively (keep first), cap length.
const MAX_DISHES = 60;

export function normalizeDishes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_DISHES) break;
  }
  return out;
}
