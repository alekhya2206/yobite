// lib/ai/askMenu.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeGroqAskMenu, buildAskContext } from "./askMenu";
import type { RankResult, RankedDish } from "@/lib/ranker/types";

const dish = (name: string, over: Partial<RankedDish> = {}): RankedDish => ({
  name,
  kind: "main",
  score: 50,
  tier: "good",
  chips: [],
  reason: `${name} reason`,
  signals: [],
  profile: { proteinG: 20, calories: 300, refinedCarb: 0, richness: 0, fried: 0, lean: 0, veg: 0, vegetarian: false },
  ...over,
});

const result = (): RankResult => ({
  best: dish("Grilled Chicken Tikka"),
  alsoGood: [],
  heavier: [],
  all: [dish("Grilled Chicken Tikka"), dish("Schezwan Noodles")],
  goalLabel: "High protein",
  bestWhy: "Lean grilled protein",
  ate: { raw: "", hadCarbs: false, hadFried: false, hadRich: false, hadProtein: false, hadSweet: false },
  dishCount: 2,
});

describe("buildAskContext", () => {
  it("includes dish names, their reasons, and grounded facts from the menu in hand", () => {
    const ctx = buildAskContext(result());
    expect(ctx).toContain("Grilled Chicken Tikka");
    expect(ctx).toContain("Schezwan Noodles");
    // grounded fact composed for the unlisted noodle dish
    expect(ctx.toLowerCase()).toMatch(/refined|maida|noodle/);
  });
});

describe("makeGroqAskMenu", () => {
  it("sends the question + ranked-menu context to Groq and returns the trimmed answer", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  Go with the Grilled Chicken Tikka — lean protein.  " } }] }),
    }) as unknown as Response);
    const ask = makeGroqAskMenu({ apiKey: "k", fetchFn });
    const answer = await ask("which is most protein?", result());
    expect(answer).toBe("Go with the Grilled Chicken Tikka — lean protein.");
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const msgs = JSON.stringify(JSON.parse(init.body as string).messages);
    expect(msgs).toContain("which is most protein?");
    expect(msgs).toContain("Grilled Chicken Tikka");
  });

  it("rejects when the LLM call fails (non-ok HTTP) so the caller can fall back", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "boom",
    }) as unknown as Response);
    const ask = makeGroqAskMenu({ apiKey: "k", fetchFn });
    await expect(ask("anything?", result())).rejects.toThrow();
  });

  it("throws on an empty answer so the caller can fall back to the local answer", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "   " } }] }),
    }) as unknown as Response);
    const ask = makeGroqAskMenu({ apiKey: "k", fetchFn });
    await expect(ask("anything?", result())).rejects.toThrow();
  });
});
