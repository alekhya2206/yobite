// lib/ai/openrouter.ts
import { parseDishList } from "./parseDishList";
import { ProviderError, type ReadMenu } from "./types";

const MODEL = "qwen/qwen-2.5-vl-72b-instruct:free";
const PROMPT =
  "Read this restaurant menu image. Extract ONLY orderable dish names (ignore prices, " +
  'headers, descriptions). Respond with a JSON array of strings and nothing else.';

interface ORDeps {
  apiKey: string;
  fetchFn?: typeof fetch;
}

export function makeOpenRouterReadMenu({ apiKey, fetchFn = fetch }: ORDeps): ReadMenu {
  return async (imageBase64, mimeType = "image/jpeg") => {
    const res = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new ProviderError("openrouter", `HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseDishList(json.choices?.[0]?.message?.content ?? "");
  };
}
