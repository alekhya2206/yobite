import { describe, it, expect } from "vitest";
import { goalToMood } from "./goalToMood";

describe("goalToMood", () => {
  it("phrases each base goal as a mood the ranker can read", () => {
    expect(goalToMood({ id: "high-protein" })).toMatch(/protein/i);
    expect(goalToMood({ id: "fat-loss" })).toMatch(/light|calor/i);
    expect(goalToMood({ id: "balanced" })).toMatch(/balanc/i);
  });
  it("uses the custom text when present", () => {
    expect(goalToMood({ id: "custom", custom: "low carb, high fibre" })).toBe("low carb, high fibre");
  });
  it("falls back to balanced for an empty custom", () => {
    expect(goalToMood({ id: "custom", custom: "" })).toMatch(/balanc/i);
  });
});
