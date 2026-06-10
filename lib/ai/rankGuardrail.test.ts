// lib/ai/rankGuardrail.test.ts
import { describe, it, expect } from "vitest";
import { applyDietFilter, checkRanking, toRankResult } from "./rankGuardrail";
import type { AIRanking, AIRankedDish, Level } from "./rankMenu";

type Row = { name: string; tier: AIRankedDish["tier"]; carbs?: Level; protein?: Level; calories?: Level; quality?: Level };

function ranking(rows: Row[]): AIRanking {
  return {
    goalLabel: "Test",
    bestWhy: "why",
    dishes: rows.map((r) => ({
      name: r.name,
      tier: r.tier,
      reason: "r",
      chips: ["c"],
      carbs: r.carbs ?? "med",
      protein: r.protein ?? "med",
      calories: r.calories ?? "med",
      quality: r.quality ?? "med",
    })),
  };
}

const menu = ["Grilled Fish", "Chicken Biryani", "Veg Fried Rice"];

describe("checkRanking — menu fidelity", () => {
  it("rejects a ranking that invents a dish not on the menu", () => {
    const r = ranking([{ name: "Pizza", tier: "best" }, { name: "Chicken Biryani", tier: "good" }]);
    expect(checkRanking(r, menu, "high carb").ok).toBe(false);
  });
  it("rejects when it drops menu dishes entirely", () => {
    const r = ranking([{ name: "Chicken Biryani", tier: "best" }]);
    expect(checkRanking(r, menu, "high carb").ok).toBe(false);
  });
  it("rejects a ranking that repeats a dish (Copilot review)", () => {
    const r = ranking([
      { name: "Chicken Biryani", tier: "best" },
      { name: "Grilled Fish", tier: "good" },
      { name: "Veg Fried Rice", tier: "good" },
      { name: "Chicken Biryani", tier: "heavier" }, // duplicate
    ]);
    expect(checkRanking(r, menu, "high carb").ok).toBe(false);
  });
});

describe("checkRanking — intent alignment (the fish-bug guard)", () => {
  it("rejects a low-carb best pick when the mood is high-carb", () => {
    const r = ranking([
      { name: "Grilled Fish", tier: "best", carbs: "low" },
      { name: "Chicken Biryani", tier: "good", carbs: "high" },
      { name: "Veg Fried Rice", tier: "heavier", carbs: "high" },
    ]);
    expect(checkRanking(r, menu, "high carb").ok).toBe(false);
  });
  it("accepts a carby best pick for a high-carb mood", () => {
    const r = ranking([
      { name: "Chicken Biryani", tier: "best", carbs: "high", quality: "high" },
      { name: "Veg Fried Rice", tier: "good", carbs: "high" },
      { name: "Grilled Fish", tier: "heavier", carbs: "low" },
    ]);
    expect(checkRanking(r, menu, "high carb").ok).toBe(true);
  });
  it("rejects a low-protein best pick when the mood is high-protein", () => {
    const r = ranking([
      { name: "Veg Fried Rice", tier: "best", protein: "low" },
      { name: "Chicken Biryani", tier: "good", protein: "high" },
      { name: "Grilled Fish", tier: "heavier", protein: "high" },
    ]);
    expect(checkRanking(r, menu, "high protein").ok).toBe(false);
  });
});

describe("checkRanking — quality floor (no junk as the best pick)", () => {
  const carbMenu = ["Maggi", "Mashed Potatoes", "Chicken Biryani"];
  it("rejects an ultra-processed/low-quality best when a better whole-food carb exists", () => {
    const r = ranking([
      { name: "Maggi", tier: "best", carbs: "high", quality: "low" },
      { name: "Mashed Potatoes", tier: "good", carbs: "high", quality: "high" },
      { name: "Chicken Biryani", tier: "heavier", carbs: "high", quality: "med" },
    ]);
    expect(checkRanking(r, carbMenu, "high carb").ok).toBe(false);
  });
  it("accepts a whole-food carb as the best pick", () => {
    const r = ranking([
      { name: "Mashed Potatoes", tier: "best", carbs: "high", quality: "high" },
      { name: "Chicken Biryani", tier: "good", carbs: "high", quality: "med" },
      { name: "Maggi", tier: "heavier", carbs: "high", quality: "low" },
    ]);
    expect(checkRanking(r, carbMenu, "high carb").ok).toBe(true);
  });
});

describe("applyDietFilter — hard veg constraint", () => {
  const mixed = ["Chicken Biryani", "Dal Tadka", "Paneer Tikka", "Tandoori Fish"];
  it("removes non-veg dishes when the mood is veg-only", () => {
    const out = applyDietFilter(mixed, "veg only, high fibre");
    expect(out).toContain("Dal Tadka");
    expect(out).toContain("Paneer Tikka");
    expect(out).not.toContain("Chicken Biryani");
    expect(out).not.toContain("Tandoori Fish");
  });
  it("leaves the menu untouched when no veg constraint is stated", () => {
    expect(applyDietFilter(mixed, "high protein")).toEqual(mixed);
  });
  it("does not filter for a non-veg mood (meat eaters can still eat veg)", () => {
    expect(applyDietFilter(mixed, "non-veg, high protein")).toEqual(mixed);
  });
});

describe("toRankResult — adapter to the stable RankResult shape", () => {
  it("maps tiers, preserves order, and attaches real kinds via the classifier", () => {
    const r = ranking([
      { name: "Chicken Biryani", tier: "best" },
      { name: "Veg Fried Rice", tier: "good" },
      { name: "Grilled Fish", tier: "heavier" },
    ]);
    const res = toRankResult(r, menu);
    expect(res.best?.name).toBe("Chicken Biryani");
    expect(res.goalLabel).toBe("Test");
    expect(res.bestWhy).toBe("why");
    expect(res.alsoGood.map((d) => d.name)).toEqual(["Veg Fried Rice"]);
    expect(res.heavier.map((d) => d.name)).toEqual(["Grilled Fish"]);
    expect(res.best?.kind).toBeTruthy();
    expect(res.dishCount).toBe(3);
    expect(res.all[0].score).toBeGreaterThan(res.all[1].score);
  });

  it("emits exactly one 'best' even if the model labels several (Copilot review)", () => {
    const r = ranking([
      { name: "Chicken Biryani", tier: "best" },
      { name: "Veg Fried Rice", tier: "best" }, // model error — must be demoted
      { name: "Grilled Fish", tier: "best" },
    ]);
    const res = toRankResult(r, menu);
    expect(res.all.filter((d) => d.tier === "best")).toHaveLength(1);
  });

  it("reflects the real ateToday in RankResult.ate (Copilot review)", () => {
    const r = ranking([{ name: "Chicken Biryani", tier: "best" }, { name: "Grilled Fish", tier: "good" }]);
    const res = toRankResult(r, menu, "2 eggs and a banana");
    expect(res.ate.raw).toBe("2 eggs and a banana");
  });
});
