// lib/ai/aiRank.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeAIRank } from "./aiRank";
import type { AIRanking } from "./rankMenu";
import type { RankResult } from "@/lib/ranker/types";

const menu = ["Grilled Fish", "Chicken Biryani", "Veg Fried Rice"];
const FALLBACK = { goalLabel: "FALLBACK" } as unknown as RankResult;

// AI nutrition estimates the guardrail reads.
const EST: Record<string, Pick<AIRanking["dishes"][number], "carbs" | "protein" | "calories" | "quality">> = {
  "Grilled Fish": { carbs: "low", protein: "high", calories: "low", quality: "high" },
  "Chicken Biryani": { carbs: "high", protein: "high", calories: "high", quality: "med" },
  "Veg Fried Rice": { carbs: "high", protein: "low", calories: "high", quality: "med" },
};

const rankingOf = (bestName: string): AIRanking => ({
  goalLabel: "High carb",
  bestWhy: "w",
  dishes: [bestName, ...menu.filter((m) => m !== bestName)].map((name, i) => ({
    name,
    tier: i === 0 ? ("best" as const) : ("good" as const),
    reason: "r",
    chips: [],
    ...EST[name],
  })),
});

describe("makeAIRank", () => {
  it("returns the AI ranking when it passes the guardrail", async () => {
    const rankMenu = vi.fn(async () => rankingOf("Chicken Biryani")); // carby best — valid
    const aiRank = makeAIRank({ rankMenu, fallback: () => FALLBACK });
    const res = await aiRank(menu, "high carb");
    expect(res.best?.name).toBe("Chicken Biryani");
    expect(rankMenu).toHaveBeenCalledTimes(1);
  });

  it("retries once when the first pick violates the mood, then accepts the fix", async () => {
    const rankMenu = vi
      .fn<typeof import("./rankMenu").RankMenu>()
      .mockResolvedValueOnce(rankingOf("Grilled Fish"))      // low-carb best — rejected
      .mockResolvedValueOnce(rankingOf("Chicken Biryani"));  // corrected
    const aiRank = makeAIRank({ rankMenu, fallback: () => FALLBACK });
    const res = await aiRank(menu, "high carb");
    expect(res.best?.name).toBe("Chicken Biryani");
    expect(rankMenu).toHaveBeenCalledTimes(2);
  });

  it("falls back to deterministic when the AI stays wrong after the retry", async () => {
    const rankMenu = vi.fn(async () => rankingOf("Grilled Fish")); // always wrong for high-carb
    const aiRank = makeAIRank({ rankMenu, fallback: () => FALLBACK });
    expect((await aiRank(menu, "high carb")).goalLabel).toBe("FALLBACK");
    expect(rankMenu).toHaveBeenCalledTimes(2);
  });

  it("falls back to deterministic when the AI call throws", async () => {
    const rankMenu = vi.fn(async () => {
      throw new Error("groq down");
    });
    const aiRank = makeAIRank({ rankMenu, fallback: () => FALLBACK });
    expect((await aiRank(menu, "high carb")).goalLabel).toBe("FALLBACK");
  });
});
