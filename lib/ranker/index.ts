// YoBite ranking brain — public entrypoint.
//
//   rank({ menuText, goal, ateToday }) → RankResult
//
// Pipeline: parse → classify → score → bucket into tiers → attach honest reasons.
// Pure and deterministic: same input always gives the same order. No network,
// no model call, no calorie database — just the menu in front of you.

import { classifyDish } from "./classify";
import { parseAte } from "./context";
import { parseMenu } from "./parse";
import { heavierReason, heroChips, heroWhy, listReason } from "./reasons";
import { goalLabel, scoreDish } from "./score";
import type { Dish, RankInput, RankResult, RankedDish, Tier } from "./types";

function tierFor(score: number, isHeavy: boolean): Tier {
  if (isHeavy) return "heavy";
  if (score >= 66) return "good";
  if (score >= 50) return "okay";
  return "heavy";
}

export function rank(input: RankInput): RankResult {
  const goal = input.goal;
  const ate = parseAte(input.ateToday);

  const names = parseMenu(input.menuText);
  const dishes: Dish[] = names.map(classifyDish);

  // Score every dish.
  const scored = dishes
    .map((dish) => ({ dish, score: scoreDish(dish, goal, ate) }))
    .sort((a, b) => b.score - a.score);

  const all: RankedDish[] = scored.map(({ dish, score }, i) => {
    // "Heavy" by character, regardless of rank: fried + rich + refined carbs.
    const p = dish.profile;
    const heavyChar = p.fried >= 0.4 || p.richness >= 0.5 || (p.refinedCarb >= 0.6 && p.proteinG < 18) || dish.kind === "dessert" || dish.kind === "drink";
    const tier: Tier = i === 0 ? "best" : tierFor(score, heavyChar);
    return {
      ...dish,
      score,
      tier,
      chips: heroChips(dish),
      reason: tier === "heavy" ? heavierReason(dish, ate) : listReason(dish, ate),
    };
  });

  const best = all.length > 0 ? { ...all[0], tier: "best" as Tier } : null;

  // The rest, split into "also good" (decent score, not heavy) and "heavier".
  const rest = all.slice(1);
  const heavier = rest.filter((d) => d.tier === "heavy").slice(0, 4);
  const heavySet = new Set(heavier);
  const alsoGood = rest.filter((d) => !heavySet.has(d)).slice(0, 4);

  return {
    best,
    alsoGood,
    heavier,
    all,
    goalLabel: goalLabel(goal),
    bestWhy: best ? heroWhy(best, goal, ate) : "",
    ate,
    dishCount: names.length,
  };
}

export { parseMenu } from "./parse";
export { classifyDish } from "./classify";
export { scoreDish, goalLabel } from "./score";
export { parseAte } from "./context";
export { askYoBite } from "./ask";

/** Detect a small set of well-known chains so we can show the "known chain" pill. */
const KNOWN_CHAINS = [
  "mcdonald", "kfc", "domino", "pizza hut", "subway", "burger king", "starbucks",
  "chowman", "wow momo", "haldiram", "barbeque nation", "cafe coffee day", "ccd",
  "taco bell", "dunkin", "faasos", "behrouz", "ovenstory", "biryani blues",
];

export function detectKnownChain(text: string): string | null {
  const t = text.toLowerCase();
  for (const c of KNOWN_CHAINS) {
    if (t.includes(c)) {
      return c.replace(/\b\w/g, (m) => m.toUpperCase());
    }
  }
  return null;
}

export type * from "./types";
