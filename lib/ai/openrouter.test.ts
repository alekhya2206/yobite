// lib/ai/openrouter.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeOpenRouterReadMenu } from "./openrouter";

describe("makeOpenRouterReadMenu", () => {
  it("posts the image as a data URL and returns parsed dishes", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '["Veg Biryani"]' } }] }),
    }) as unknown as Response);
    const read = makeOpenRouterReadMenu({ apiKey: "k", fetchFn });
    expect(await read("BASE64", "image/png")).toEqual(["Veg Biryani"]);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(String(init.body)).toContain("data:image/png;base64,BASE64");
  });

  it("throws ProviderError on non-ok response", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500, text: async () => "err" }) as unknown as Response);
    const read = makeOpenRouterReadMenu({ apiKey: "k", fetchFn });
    await expect(read("X")).rejects.toThrow(/openrouter/i);
  });
});
