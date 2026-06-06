// lib/ai/gemini.ts
import { parseDishList } from "./parseDishList";
import { ProviderError, type ReadMenu } from "./types";

// gemini-2.5-flash: current free-tier vision model. (2.0-flash has limit:0 on
// newer accounts; 2.5 is both available on free tier and a stronger reader.)
const MODEL = "gemini-2.5-flash";
const PROMPT =
  "You are reading a restaurant menu image. Extract ONLY the orderable dish names. " +
  "Ignore prices, section headers, descriptions, and addresses. " +
  'Respond with a JSON array of strings, e.g. ["Paneer Tikka","Dal Makhani"]. No other text.';

interface GeminiDeps {
  apiKey: string;
  fetchFn?: typeof fetch;
}

export function makeGeminiReadMenu({ apiKey, fetchFn = fetch }: GeminiDeps): ReadMenu {
  return async (imageBase64, mimeType = "image/jpeg") => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: PROMPT },
          ],
        },
      ],
    };
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new ProviderError("gemini", `HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseDishList(text);
  };
}
