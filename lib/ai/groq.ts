// lib/ai/groq.ts
// Groq provider (OpenAI-compatible). Hosts open models with a real free tier and very fast
// inference — our primary AI for both menu reading (vision) and intent parsing (text).
import { parseDishList } from "./parseDishList";
import { MENU_READ_PROMPT } from "./prompts";
import { ProviderError, type ReadMenu } from "./types";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Multimodal model for reading menu photos. Text model for everything else.
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";

interface ChatOpts {
  apiKey: string;
  model: string;
  messages: unknown[];
  fetchFn?: typeof fetch;
  /** Fail fast instead of hanging (the Gemini-503 hang took ~36s). */
  timeoutMs?: number;
  /** 0 = deterministic. Default 0 — we want stable, repeatable rankings. */
  temperature?: number;
}

/** Low-level OpenAI-compatible chat call → returns the assistant message text. */
export async function groqChat({
  apiKey,
  model,
  messages,
  fetchFn = fetch,
  timeoutMs = 20000,
  temperature = 0,
}: ChatOpts): Promise<string> {
  const res = await fetchFn(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new ProviderError("groq", `HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

interface ReadMenuDeps {
  apiKey: string;
  fetchFn?: typeof fetch;
  model?: string;
  timeoutMs?: number;
}

export function makeGroqReadMenu({
  apiKey,
  fetchFn,
  model = GROQ_VISION_MODEL,
  timeoutMs = 30000,
}: ReadMenuDeps): ReadMenu {
  return async (imageBase64, mimeType = "image/jpeg") => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: MENU_READ_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ];
    const text = await groqChat({ apiKey, model, messages, fetchFn, timeoutMs });
    return parseDishList(text);
  };
}
