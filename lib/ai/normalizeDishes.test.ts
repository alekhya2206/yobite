// lib/ai/normalizeDishes.test.ts
import { describe, it, expect } from "vitest";
import { normalizeDishes } from "./normalizeDishes";

describe("normalizeDishes", () => {
  it("trims whitespace and drops empty/blank entries", () => {
    expect(normalizeDishes(["  Paneer Tikka ", "", "   ", "Dal Makhani"]))
      .toEqual(["Paneer Tikka", "Dal Makhani"]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    expect(normalizeDishes(["Paneer Tikka", "paneer tikka", "PANEER TIKKA"]))
      .toEqual(["Paneer Tikka"]);
  });

  it("caps the list at 60 dishes", () => {
    const many = Array.from({ length: 80 }, (_, i) => `Dish ${i}`);
    expect(normalizeDishes(many)).toHaveLength(60);
  });

  it("returns an empty array for null/garbage input", () => {
    expect(normalizeDishes(null)).toEqual([]);
    expect(normalizeDishes("not an array")).toEqual([]);
  });
});
