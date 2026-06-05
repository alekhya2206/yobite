// YoBite ranking brain — type contracts.
//
// This is a *ranker, not a calorie calculator*. Everything here is built to produce
// a confident order with honest reasons, not fake-precise numbers. Estimates are
// deliberately coarse (ranges, "~32g") because the whole point is the local place
// that never published a single calorie.

/** The goals offered on the input screen. `custom` carries a free-text intent. */
export type GoalId = "high-protein" | "fat-loss" | "balanced" | "custom";

export interface Goal {
  id: GoalId;
  /** Free text when id === "custom" (e.g. "low carb, vegetarian"). */
  custom?: string;
}

/** What kind of thing a menu line is. Drives bucketing and reasons. */
export type DishKind =
  | "main"
  | "starter"
  | "salad"
  | "soup"
  | "rice"
  | "bread"
  | "side"
  | "dessert"
  | "drink";

/** Coarse, honest nutrition read of a single dish, all derived from its name. */
export interface DishProfile {
  /** Estimated protein in grams (coarse). */
  proteinG: number;
  /** Estimated calories (coarse, used only for relative ranking). */
  calories: number;
  /** 0–1: how refined-carb-heavy (white rice, naan, noodles, fries...). */
  refinedCarb: number;
  /** 0–1: richness — cream, butter, cheese, deep oil. */
  richness: number;
  /** 0–1: how deep-fried / battered it is. */
  fried: number;
  /** 0–1: how lean & light the cooking method is (grilled, steamed, tandoori). */
  lean: number;
  /** 0–1: vegetable / freshness load. */
  veg: number;
  /** True when the dish has no meat/fish (paneer, dal, tofu count as veg). */
  vegetarian: boolean;
}

/** A parsed + classified dish before scoring. */
export interface Dish {
  /** Cleaned display name. */
  name: string;
  kind: DishKind;
  profile: DishProfile;
  /** Raw tokens that matched, for explainability/debug. */
  signals: string[];
}

/** Visual tier used by the result screen. */
export type Tier = "best" | "good" | "okay" | "heavy";

/** A dish after scoring + reason generation — ready to render. */
export interface RankedDish extends Dish {
  /** 0–100, goal-relative. */
  score: number;
  tier: Tier;
  /** Short positive chips for the hero pick ("High protein", "Grilled, not fried"). */
  chips: string[];
  /** One short line for list rows ("Lean and grilled · skip the naan"). */
  reason: string;
}

/** What the user already ate today, parsed into signals. */
export interface AteContext {
  raw: string;
  hadCarbs: boolean;
  hadFried: boolean;
  hadRich: boolean;
  hadProtein: boolean;
  hadSweet: boolean;
}

export interface RankInput {
  menuText: string;
  goal: Goal;
  ateToday?: string;
}

export interface RankResult {
  /** The single confident pick. Null only if the menu had nothing rankable. */
  best: RankedDish | null;
  /** A few solid alternatives (green/amber dots). */
  alsoGood: RankedDish[];
  /** Heavier choices, gently flagged (terracotta), never scolded. */
  heavier: RankedDish[];
  /** The full ranked list, best → worst, for anything else that needs it. */
  all: RankedDish[];
  /** A human label for the goal, e.g. "High protein". */
  goalLabel: string;
  /** A one-sentence "why" for the hero pick, context-aware. */
  bestWhy: string;
  ate: AteContext;
  /** How many lines we could actually read as dishes. */
  dishCount: number;
}
