// lib/ai/gemini.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeGeminiReadMenu } from "./gemini";

const okResponse = (dishesJson: string) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: dishesJson }] } }],
  }),
});

describe("makeGeminiReadMenu", () => {
  it("posts the image and returns parsed dishes", async () => {
    const fetchFn = vi.fn(async () => okResponse('["Paneer Tikka","Dal Makhani"]') as unknown as Response);
    const read = makeGeminiReadMenu({ apiKey: "k", fetchFn });
    const dishes = await read("BASE64DATA", "image/jpeg");
    expect(dishes).toEqual(["Paneer Tikka", "Dal Makhani"]);
    // sent to the Gemini endpoint with the key
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("key=k");
  });

  it("throws ProviderError on a non-ok HTTP response", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limited" }) as unknown as Response);
    const read = makeGeminiReadMenu({ apiKey: "k", fetchFn });
    await expect(read("X")).rejects.toThrow(/gemini/i);
  });
});
