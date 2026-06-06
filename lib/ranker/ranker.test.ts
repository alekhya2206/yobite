import { describe, expect, it } from "vitest";
import { classifyDish } from "./classify";
import { parseAte } from "./context";
import { parseMenu } from "./parse";
import { rank } from "./index";
import { parseCustomGoal, scoreDish } from "./score";
import type { Goal } from "./types";

const HP: Goal = { id: "high-protein" };
const FL: Goal = { id: "fat-loss" };
const BAL: Goal = { id: "balanced" };

// A realistic messy Indian / Indo-Chinese menu paste, prices and headers included.
const INDIAN_MENU = `
STARTERS
Grilled Chicken Tikka ........ ₹320
Paneer Tikka Salad — 280
Chicken 65 .... 260
Veg Spring Rolls 180

MAIN COURSE
Butter Chicken ₹380
Tandoori Fish 420
Dal Tadka 220
Palak Paneer 260

RICE & BREADS
Chicken Biryani 350
Hakka Noodles 240
Garlic Naan 60
Jeera Rice 180

DESSERTS
Gulab Jamun 120

BEVERAGES
Sweet Lassi 90
`;

describe("parseMenu", () => {
  it("strips prices, headers, and dotted leaders", () => {
    const dishes = parseMenu(INDIAN_MENU);
    expect(dishes).toContain("Grilled Chicken Tikka");
    expect(dishes).toContain("Butter Chicken");
    expect(dishes).toContain("Paneer Tikka Salad");
    // No section headers.
    expect(dishes).not.toContain("STARTERS");
    expect(dishes).not.toContain("MAIN COURSE");
    expect(dishes).not.toContain("DESSERTS");
    // No bare prices left clinging.
    for (const d of dishes) {
      expect(d).not.toMatch(/₹|\d{3}/);
    }
  });

  it("handles a comma-separated single-line paste", () => {
    const dishes = parseMenu("grilled chicken, butter chicken, dal, naan, paneer tikka");
    expect(dishes.length).toBe(5);
    expect(dishes).toContain("paneer tikka");
  });

  it("de-duplicates repeated dishes", () => {
    const dishes = parseMenu("Dal Tadka\nDal Tadka\nDAL TADKA");
    expect(dishes.length).toBe(1);
  });

  it("returns nothing for junk", () => {
    expect(parseMenu("")).toEqual([]);
    expect(parseMenu("\n\n   \n")).toEqual([]);
  });

  it("keeps numeric dish suffixes (Chicken 65) but strips real prices", () => {
    expect(parseMenu("Chicken 65")).toEqual(["Chicken 65"]);
    expect(parseMenu("Chicken 65 ₹260")).toEqual(["Chicken 65"]);
    expect(parseMenu("Chicken 65 260")).toEqual(["Chicken 65"]);
    expect(parseMenu("Garlic Naan 60")).toEqual(["Garlic Naan"]);
  });
});

describe("classifyDish", () => {
  it("reads grilled chicken as lean, high-protein, non-veg", () => {
    const d = classifyDish("Grilled Chicken Tikka");
    expect(d.profile.proteinG).toBeGreaterThanOrEqual(25);
    expect(d.profile.lean).toBeGreaterThan(0.3);
    expect(d.profile.fried).toBeLessThan(0.2);
    expect(d.profile.vegetarian).toBe(false);
  });

  it("reads butter chicken as rich", () => {
    const d = classifyDish("Butter Chicken");
    expect(d.profile.richness).toBeGreaterThan(0.3);
  });

  it("reads chicken 65 as fried", () => {
    const d = classifyDish("Chicken 65");
    expect(d.profile.fried).toBeGreaterThan(0.3);
    expect(d.kind).toBe("starter");
  });

  it("reads stir-fried as a lean method, not deep-fried", () => {
    // "Stir Fried" contains the token "fried" but stir-frying is a lean,
    // light method — it must not be penalized like deep-frying.
    const d = classifyDish("Stir Fried Chicken with Basil");
    expect(d.profile.fried).toBeLessThan(0.2);
    expect(d.profile.lean).toBeGreaterThan(0.3);
    expect(d.signals).toContain("stir fried");
    expect(d.signals).not.toContain("fried");
  });

  it("records the actual matched stir-fry phrase in signals", () => {
    // "stir fry" (no -ied) should surface as "stir fry", not "stir fried".
    const d = classifyDish("Chicken Stir Fry");
    expect(d.signals).toContain("stir fry");
    expect(d.signals).not.toContain("stir fried");
  });

  it("reads paneer as vegetarian protein", () => {
    const d = classifyDish("Palak Paneer");
    expect(d.profile.vegetarian).toBe(true);
    expect(d.profile.proteinG).toBeGreaterThanOrEqual(15);
    expect(d.profile.veg).toBeGreaterThan(0);
  });

  it("reads biryani as carb-heavy", () => {
    const d = classifyDish("Chicken Biryani");
    expect(d.profile.refinedCarb).toBeGreaterThan(0.6);
  });

  it("classifies kinds", () => {
    expect(classifyDish("Garlic Naan").kind).toBe("bread");
    expect(classifyDish("Gulab Jamun").kind).toBe("dessert");
    expect(classifyDish("Sweet Lassi").kind).toBe("drink");
    expect(classifyDish("Tomato Soup").kind).toBe("soup");
    expect(classifyDish("Greek Salad").kind).toBe("salad");
  });

  it("does not false-match egg inside other words", () => {
    const d = classifyDish("Veggie Wrap");
    expect(d.signals).not.toContain("egg");
  });
});

describe("scoreDish by goal", () => {
  const grilled = classifyDish("Grilled Chicken Tikka");
  const butter = classifyDish("Butter Chicken");
  const biryani = classifyDish("Chicken Biryani");
  const salad = classifyDish("Paneer Tikka Salad");
  const empty = parseAte("");

  it("high-protein favours grilled chicken over naan", () => {
    const naan = classifyDish("Garlic Naan");
    expect(scoreDish(grilled, HP, empty)).toBeGreaterThan(scoreDish(naan, HP, empty));
  });

  it("fat-loss ranks salad and grilled above butter chicken & biryani", () => {
    expect(scoreDish(salad, FL, empty)).toBeGreaterThan(scoreDish(butter, FL, empty));
    expect(scoreDish(grilled, FL, empty)).toBeGreaterThan(scoreDish(biryani, FL, empty));
  });

  it("fried/rich/carby dishes score lower than lean ones for every goal", () => {
    for (const g of [HP, FL, BAL]) {
      expect(scoreDish(grilled, g, empty)).toBeGreaterThan(scoreDish(butter, g, empty));
    }
  });
});

describe("rank — end to end", () => {
  it("picks a lean protein dish as the best for high-protein", () => {
    const r = rank({ menuText: INDIAN_MENU, goal: HP });
    expect(r.best).not.toBeNull();
    expect(r.best!.name.toLowerCase()).toMatch(/grilled chicken|tandoori fish|chicken tikka/);
    expect(r.best!.tier).toBe("best");
    expect(r.best!.chips.length).toBeGreaterThan(0);
    expect(r.bestWhy.length).toBeGreaterThan(10);
  });

  it("puts butter chicken / biryani / naan in heavier, not best", () => {
    const r = rank({ menuText: INDIAN_MENU, goal: FL });
    const heavyNames = r.heavier.map((d) => d.name.toLowerCase()).join(" ");
    expect(heavyNames).toMatch(/butter chicken|biryani|naan|noodles|gulab/);
    expect(r.best!.name.toLowerCase()).not.toMatch(/butter chicken|biryani/);
  });

  it("never recommends a dessert or drink as the best pick when real food exists", () => {
    const r = rank({ menuText: INDIAN_MENU, goal: BAL });
    expect(r.best!.kind).not.toBe("dessert");
    expect(r.best!.kind).not.toBe("drink");
  });

  it("uses 'ate today' to demote more carbs and reflect it in the why", () => {
    const withRice = rank({ menuText: INDIAN_MENU, goal: HP, ateToday: "rice and dal at lunch" });
    expect(withRice.ate.hadCarbs).toBe(true);
    // Biryani should be pushed down relative to no-context.
    const biryaniRankWith = withRice.all.findIndex((d) => /biryani/i.test(d.name));
    const noCtx = rank({ menuText: INDIAN_MENU, goal: HP });
    const biryaniRankNo = noCtx.all.findIndex((d) => /biryani/i.test(d.name));
    expect(biryaniRankWith).toBeGreaterThanOrEqual(biryaniRankNo);
  });

  it("respects a vegetarian custom goal", () => {
    const r = rank({ menuText: INDIAN_MENU, goal: { id: "custom", custom: "vegetarian high protein" } });
    expect(r.best!.profile.vegetarian).toBe(true);
  });

  it("produces the three display buckets", () => {
    const r = rank({ menuText: INDIAN_MENU, goal: HP });
    expect(r.best).not.toBeNull();
    expect(r.alsoGood.length).toBeGreaterThan(0);
    expect(r.heavier.length).toBeGreaterThan(0);
    // No dish appears in two buckets.
    const ids = [r.best!.name, ...r.alsoGood.map((d) => d.name), ...r.heavier.map((d) => d.name)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("handles an empty / unrankable menu gracefully", () => {
    const r = rank({ menuText: "", goal: HP });
    expect(r.best).toBeNull();
    expect(r.dishCount).toBe(0);
  });

  it("is deterministic", () => {
    const a = rank({ menuText: INDIAN_MENU, goal: FL, ateToday: "samosa" });
    const b = rank({ menuText: INDIAN_MENU, goal: FL, ateToday: "samosa" });
    expect(a.best!.name).toBe(b.best!.name);
    expect(a.all.map((d) => d.name)).toEqual(b.all.map((d) => d.name));
  });
});

describe("parseCustomGoal", () => {
  it("detects low-carb / keto", () => {
    expect(parseCustomGoal("keto, no rice").lowCarb).toBe(true);
  });
  it("detects vegetarian but not non-veg", () => {
    expect(parseCustomGoal("vegetarian").vegetarianOnly).toBe(true);
    expect(parseCustomGoal("non-veg high protein").vegetarianOnly).toBe(false);
  });
  it("maps 'light' to fat-loss base", () => {
    expect(parseCustomGoal("something light").base).toBe("fat-loss");
  });
});

describe("parseAte", () => {
  it("reads carbs, fried, protein, sweet", () => {
    const a = parseAte("had a chicken sandwich and fries, then ice cream");
    expect(a.hadCarbs).toBe(true);
    expect(a.hadFried).toBe(true);
    expect(a.hadProtein).toBe(true);
    expect(a.hadSweet).toBe(true);
  });
  it("is empty for blank input", () => {
    expect(parseAte("").hadCarbs).toBe(false);
  });
});
