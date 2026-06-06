// lib/meal/resolveMealGoal.test.ts
import { describe, it, expect } from "vitest";
import { resolveMealGoal } from "./resolveMealGoal";

describe("resolveMealGoal", () => {
  it("returns the profile goal when the text is empty (skip → universal)", () => {
    expect(resolveMealGoal("", { id: "high-protein" })).toEqual({ id: "high-protein" });
    expect(resolveMealGoal("   ", { id: "fat-loss" })).toEqual({ id: "fat-loss" });
  });

  it("classifies free text into a goal when provided", () => {
    expect(resolveMealGoal("something light, trying to cut", { id: "balanced" }).id).toBe("fat-loss");
    expect(resolveMealGoal("high protein please", { id: "balanced" }).id).toBe("high-protein");
  });

  it("keeps unrecognized intent as a custom goal", () => {
    const g = resolveMealGoal("low carb vegetarian", { id: "balanced" });
    expect(g.id).toBe("custom");
    expect(g.custom).toBe("low carb vegetarian");
  });
});
