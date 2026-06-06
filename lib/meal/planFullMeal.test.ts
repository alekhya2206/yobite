// lib/meal/planFullMeal.test.ts
import { describe, it, expect } from "vitest";
import { rank } from "@/lib/ranker";
import { planFullMeal } from "./planFullMeal";

describe("planFullMeal", () => {
  it("picks a best starter, main, and dessert from a ranked menu", () => {
    const result = rank({
      menuText: [
        "Paneer Tikka",          // starter
        "Grilled Chicken Tikka", // starter (lean)
        "Butter Chicken",        // main
        "Dal Tadka",             // main
        "Gulab Jamun",           // dessert
      ].join("\n"),
      goal: { id: "high-protein" },
    });
    const meal = planFullMeal(result);
    expect(meal.starter).not.toBeNull();
    expect(["starter", "salad", "soup"]).toContain(meal.starter!.kind);
    expect(meal.main).not.toBeNull();
    expect(["main", "rice"]).toContain(meal.main!.kind);
    expect(meal.dessert?.name).toBe("Gulab Jamun");
  });

  it("returns null for a course the menu doesn't cover", () => {
    const result = rank({ menuText: "Dal Tadka\nButter Chicken", goal: { id: "balanced" } });
    const meal = planFullMeal(result);
    expect(meal.main).not.toBeNull();
    expect(meal.starter).toBeNull();
    expect(meal.dessert).toBeNull();
  });

  it("picks the highest-ranked dish within each course", () => {
    // 'all' is best→worst; the first starter encountered must be the chosen one.
    const result = rank({
      menuText: "Fried Chicken Wings\nGrilled Chicken Salad\nButter Chicken",
      goal: { id: "fat-loss" },
    });
    const meal = planFullMeal(result);
    const starters = result.all.filter((d) => ["starter", "salad", "soup"].includes(d.kind));
    expect(meal.starter?.name).toBe(starters[0]?.name);
  });
});
