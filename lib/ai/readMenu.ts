// lib/ai/readMenu.ts
import { makeGroqReadMenu } from "./groq";
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

// Build the real pipeline from environment keys, in priority order:
// Groq (free-tier vision) → Gemini → OpenRouter. The first configured provider is the
// primary; the next is its single fallback.
export function readMenuFromEnv(): ReadMenu {
  const groq = process.env.GROQ_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  const openrouter = process.env.OPENROUTER_API_KEY;

  const providers: ReadMenu[] = [
    groq ? makeGroqReadMenu({ apiKey: groq }) : null,
    gemini ? makeGeminiReadMenu({ apiKey: gemini }) : null,
    openrouter ? makeOpenRouterReadMenu({ apiKey: openrouter }) : null,
  ].filter((p): p is ReadMenu => p !== null);

  if (providers.length === 0) {
    throw new Error("No AI keys configured: set GROQ_API_KEY (and/or GEMINI_API_KEY, OPENROUTER_API_KEY)");
  }
  return makeReadMenu(providers[0], providers[1] ?? null);
}
