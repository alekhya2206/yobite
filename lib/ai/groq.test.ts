// lib/ai/groq.test.ts
import { describe, it, expect, vi } from "vitest";
import { groqChat, makeGroqReadMenu } from "./groq";

const chatBody = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

describe("groqChat", () => {
  it("posts an OpenAI-style chat request to the Groq endpoint and returns the message text", async () => {
    const fetchFn = vi.fn(async () => chatBody("hello") as unknown as Response);
    const out = await groqChat({ apiKey: "k", model: "m", messages: [{ role: "user", content: "hi" }], fetchFn });
    expect(out).toBe("hello");
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("api.groq.com");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(init.body as string).model).toBe("m");
  });

  it("throws a ProviderError on a non-ok response", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key" }) as unknown as Response);
    await expect(groqChat({ apiKey: "k", model: "m", messages: [], fetchFn })).rejects.toThrow(/groq/i);
  });
});

describe("makeGroqReadMenu (vision)", () => {
  it("sends the image as a data URL to the vision model and parses the dish list", async () => {
    const fetchFn = vi.fn(async () => chatBody('["Paneer Tikka","Dal Makhani"]') as unknown as Response);
    const read = makeGroqReadMenu({ apiKey: "k", fetchFn });
    expect(await read("BASE64DATA", "image/png")).toEqual(["Paneer Tikka", "Dal Makhani"]);

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    const parts = body.messages[0].content as { type: string; image_url?: { url: string } }[];
    const img = parts.find((p) => p.type === "image_url");
    expect(img?.image_url?.url).toBe("data:image/png;base64,BASE64DATA");
  });

  it("tolerates a ```json fenced array (parseDishList handles it)", async () => {
    const fetchFn = vi.fn(async () => chatBody('```json\n["Idli","Vada"]\n```') as unknown as Response);
    const read = makeGroqReadMenu({ apiKey: "k", fetchFn });
    expect(await read("X")).toEqual(["Idli", "Vada"]);
  });
});
