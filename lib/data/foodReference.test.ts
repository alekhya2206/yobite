import { describe, it, expect } from "vitest";
import { lookupFood, FOOD_REFERENCE } from "./foodReference";

describe("foodReference", () => {
  it("has clean, complete entries", () => {
    for (const e of FOOD_REFERENCE) {
      expect(e.match).toBe(e.match.toLowerCase());
      expect(e.note.length).toBeGreaterThan(0);
    }
  });

  it("matches a dish name to its grounded record (longest/most-specific wins)", () => {
    expect(lookupFood("Maggi Masala")?.quality).toBe("low");
    expect(lookupFood("Mashed Potatoes")?.quality).toBe("high");
    expect(lookupFood("Grilled Chicken Breast")?.protein).toBe("high");
  });

  it("encodes the research judgement that fried rice is a better carb than chow mein", () => {
    const fr = lookupFood("Veg Fried Rice");
    const cm = lookupFood("Chicken Chow Mein");
    const order = { low: 0, med: 1, high: 2 } as const;
    expect(order[fr!.quality]).toBeGreaterThanOrEqual(order[cm!.quality]);
  });

  it("returns null for an unknown dish (AI estimate will fill the gap)", () => {
    expect(lookupFood("Klingon Gagh Stew")).toBeNull();
  });
});
