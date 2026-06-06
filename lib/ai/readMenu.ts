// lib/ai/readMenu.ts
import { makeGeminiReadMenu } from "./gemini";
import { makeOpenRouterReadMenu } from "./openrouter";
import { normalizeDishes } from "./normalizeDishes";
import { withFallback } from "./withFallback";
import type { ReadMenu } from "./types";

// Compose: try primary, fall back, then normalize the result.
export function makeReadMenu(primary: ReadMenu, fallback: ReadMenu | null): ReadMenu {
  const run = withFallback(primary, fallback);
  return async (img, mime) => normalizeDishes(await run(img, mime));
}

// Build the real pipeline from environment keys. Gemini primary, OpenRouter fallback.
export function readMenuFromEnv(): ReadMenu {
  const gemini = process.env.GEMINI_API_KEY;
  const openrouter = process.env.OPENROUTER_API_KEY;
  if (!gemini && !openrouter) {
    throw new Error("No AI keys configured: set GEMINI_API_KEY and/or OPENROUTER_API_KEY");
  }
  const primary: ReadMenu | null = gemini ? makeGeminiReadMenu({ apiKey: gemini }) : null;
  const fallback: ReadMenu | null = openrouter ? makeOpenRouterReadMenu({ apiKey: openrouter }) : null;
  // If only one is configured, use it as primary with no fallback.
  const main = primary ?? fallback!;
  const back = primary ? fallback : null;
  return makeReadMenu(main, back);
}
