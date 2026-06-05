// Scoring: turn a DishProfile into a 0–100 goal-relative score.
//
// Each goal is a weight vector over the profile dimensions, plus the "what you ate
// today" context as a modifier. The point isn't a precise health score — it's a
// *stable ranking* so the best pick for THIS person, THIS goal, rises to the top.

import type { AteContext, Dish, Goal, GoalId } from "./types";

interface Weights {
  protein: number; // per gram
  lean: number;
  veg: number;
  fried: number; // negative
  richness: number; // negative
  refinedCarb: number; // negative
  calorie: number; // per 100 cal, negative
}

const GOAL_WEIGHTS: Record<Exclude<GoalId, "custom">, Weights> = {
  "high-protein": {
    protein: 1.7,
    lean: 10,
    veg: 5,
    fried: -10,
    richness: -10,
    refinedCarb: -16,
    calorie: -1.5,
  },
  "fat-loss": {
    protein: 1.1,
    lean: 18,
    veg: 16,
    fried: -26,
    richness: -24,
    refinedCarb: -28,
    calorie: -5,
  },
  balanced: {
    protein: 0.9,
    lean: 12,
    veg: 14,
    fried: -16,
    richness: -14,
    refinedCarb: -14,
    calorie: -2.5,
  },
};

export interface CustomIntent {
  /** Detected modifiers from a custom goal string. */
  base: Exclude<GoalId, "custom">;
  lowCarb: boolean;
  vegetarianOnly: boolean;
  highProtein: boolean;
  light: boolean;
}

/** Read a free-text custom goal into a base goal + modifiers. */
export function parseCustomGoal(custom: string): CustomIntent {
  const t = (custom || "").toLowerCase();
  const lowCarb = /low[\s-]?carb|keto|no rice|less rice|carb free|no carb/.test(t);
  const highProtein = /high[\s-]?protein|more protein|protein|muscle|bulk|gain/.test(t);
  const light = /light|fat[\s-]?loss|weight loss|lose weight|lean|cut|diet|low cal/.test(t);
  const vegetarianOnly = /\bveg\b|vegetarian|vegan|no meat|plant/.test(t) && !/non[\s-]?veg/.test(t);
  let base: Exclude<GoalId, "custom"> = "balanced";
  if (light) base = "fat-loss";
  else if (highProtein) base = "high-protein";
  return { base, lowCarb, vegetarianOnly, highProtein, light };
}

function weightsForGoal(goal: Goal): { w: Weights; custom?: CustomIntent } {
  if (goal.id === "custom") {
    const intent = parseCustomGoal(goal.custom || "");
    const base = { ...GOAL_WEIGHTS[intent.base] };
    if (intent.lowCarb) base.refinedCarb -= 12;
    if (intent.highProtein) base.protein += 0.6;
    if (intent.light) base.calorie -= 2;
    return { w: base, custom: intent };
  }
  return { w: GOAL_WEIGHTS[goal.id] };
}

/**
 * Score a dish 0–100 for the goal, adjusted by what was already eaten today.
 * Higher = order this.
 */
export function scoreDish(dish: Dish, goal: Goal, ate: AteContext): number {
  const { w, custom } = weightsForGoal(goal);
  const p = dish.profile;

  let s = 50; // neutral baseline
  s += p.proteinG * w.protein;
  s += p.lean * w.lean;
  s += p.veg * w.veg;
  s += p.fried * w.fried;
  s += p.richness * w.richness;
  s += p.refinedCarb * w.refinedCarb;
  s += (p.calories / 100) * w.calorie;

  // --- "what you ate today" balancing ----------------------------------------
  // If they've already loaded up on carbs, push carb-heavy dishes further down
  // and reward lean protein that completes the day.
  if (ate.hadCarbs) {
    s -= p.refinedCarb * 14;
    if (p.proteinG >= 20 && p.refinedCarb < 0.4) s += 5;
  }
  if (ate.hadFried) s -= p.fried * 12;
  if (ate.hadRich) s -= p.richness * 12;
  if (ate.hadProtein && goal.id === "high-protein") {
    // They've had protein — soften the protein chase a touch, value lightness.
    s -= Math.max(0, p.proteinG - 20) * 0.3;
    s += p.veg * 4;
  }
  if (ate.hadSweet) s -= dish.kind === "dessert" ? 18 : 0;

  // --- kind nudges ------------------------------------------------------------
  // Drinks and desserts are rarely "the order" — keep them out of the top unless
  // truly nothing else exists.
  if (dish.kind === "drink") s -= 30;
  if (dish.kind === "dessert") s -= 22;
  if (dish.kind === "bread" || dish.kind === "rice") s -= 8;
  // A main dish with real protein is the heart of an order — small bump.
  if (dish.kind === "main" && p.proteinG >= 18) s += 4;

  // --- custom modifiers -------------------------------------------------------
  if (custom) {
    if (custom.vegetarianOnly && !p.vegetarian) s -= 40;
    if (custom.lowCarb) s -= p.refinedCarb * 10;
  }

  return Math.max(0, Math.min(100, Math.round(s)));
}

export const GOAL_LABELS: Record<GoalId, string> = {
  "high-protein": "High protein",
  "fat-loss": "Fat loss",
  balanced: "Balanced",
  custom: "Custom",
};

export function goalLabel(goal: Goal): string {
  if (goal.id === "custom" && goal.custom?.trim()) {
    const c = goal.custom.trim();
    return c.length <= 22 ? c.replace(/\b\w/g, (m) => m.toUpperCase()) : "Custom goal";
  }
  return GOAL_LABELS[goal.id];
}
