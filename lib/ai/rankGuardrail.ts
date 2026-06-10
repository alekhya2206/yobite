// lib/ai/rankGuardrail.ts
// The STRICT, deterministic safety net for the AI ranking (Architecture B). It can never let
// the AI (1) invent a dish that isn't on the menu, (2) drop menu dishes, or (3) hand back a
// best pick that contradicts the stated mood (the fish-for-high-carb class of bug). It uses
// the deterministic classifier as the reference for the intent-alignment check.
import { classifyDish } from "@/lib/ranker/classify";
import { parseAte } from "@/lib/ranker/context";
import { lookupFood } from "@/lib/data/foodReference";
import type { RankResult, RankedDish, Tier as RankTier } from "@/lib/ranker/types";
import type { AIRanking, Level } from "./rankMenu";

/** Effective nutrition read for a dish: our research reference is AUTHORITATIVE where it
 *  exists; otherwise we trust the AI's own estimate. */
function attrs(d: AIRanking["dishes"][number]): { carbs: Level; protein: Level; calories: Level; quality: Level } {
  const ref = lookupFood(d.name);
  return {
    carbs: ref?.carbs ?? d.carbs,
    protein: ref?.protein ?? d.protein,
    calories: ref?.calories ?? d.calories,
    quality: ref?.quality ?? d.quality,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// The seed of the "quality" reference data: foods that are nutritionally poor regardless of
// macros (ultra-processed / refined junk). They must never be the BEST pick when a real
// whole-food option exists — this is what stops "Maggi" winning a high-carb request.
const ULTRA_PROCESSED = [
  "maggi", "instant noodle", "cup noodle", "ramen", "2 minute", "2-minute",
  "packaged", "packet", "frozen", "processed",
];
function isUltraProcessed(name: string): boolean {
  const t = norm(name);
  return ULTRA_PROCESSED.some((j) => t.includes(j));
}

/** Hard dietary filter. A vegetarian literally cannot eat meat, so "veg only" removes
 *  non-veg dishes from the menu BEFORE ranking. (Non-veg is a soft preference — a meat
 *  eater can still have veg — so we don't filter the other way.) */
export function applyDietFilter(dishes: string[], mood: string): string[] {
  const t = norm(mood);
  const vegOnly =
    /\bveg\b|veg only|vegetarian|vegan|no meat|plant.?based|only veg/.test(t) && !/non.?veg/.test(t);
  if (!vegOnly) return dishes;
  const veg = dishes.filter((d) => classifyDish(d).profile.vegetarian);
  return veg.length > 0 ? veg : dishes; // never strand the diner with nothing
}

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

type Want =
  | { field: "carbs" | "protein" | "calories"; level: "high" | "low" }
  | "sweet"
  | null;

/** Detect the dominant nutrition axis the mood demands, if any. Only strong, unambiguous
 *  intents get a hard check; everything else relies on the rubric prompt. */
function intentAxis(mood: string): Want {
  const t = norm(mood);
  if (/high.?carb|more carb|carb.?load|loaded|extra rice|more rice/.test(t)) return { field: "carbs", level: "high" };
  if (/low.?carb|keto|no rice|less carb|no bread/.test(t)) return { field: "carbs", level: "low" };
  if (/high.?protein|more protein|protein|muscle|bulk|gains?/.test(t)) return { field: "protein", level: "high" };
  if (/light|low.?cal|lean|cutting|fat.?loss|fewer calor|less calor/.test(t)) return { field: "calories", level: "low" };
  if (/sweet|dessert|mithai/.test(t)) return "sweet";
  return null;
}

/** Does this dish satisfy the wanted axis (reference-grounded)? Lenient: "med" passes. */
function meetsWant(d: AIRanking["dishes"][number], want: Want): boolean {
  if (!want || want === "sweet") return true;
  const v = attrs(d)[want.field];
  return want.level === "high" ? v !== "low" : v !== "high";
}

/** Validate a proposed AI ranking against the menu and the mood. Uses the AI's OWN per-dish
 *  nutrition estimates (reliable for food it knows) rather than the weak keyword classifier. */
export function checkRanking(ai: AIRanking, menu: string[], mood: string): GuardResult {
  const menuSet = new Set(menu.map(norm));

  // (1) No invented dishes.
  for (const d of ai.dishes) {
    if (!menuSet.has(norm(d.name))) return { ok: false, reason: `invented dish: ${d.name}` };
  }
  // (2) No dropped dishes — must cover the whole menu.
  const ranked = new Set(ai.dishes.map((d) => norm(d.name)));
  for (const m of menuSet) {
    if (!ranked.has(m)) return { ok: false, reason: `missing dish: ${m}` };
  }
  // (2b) No duplicates — every dish exactly once (a repeat would skew dishCount/UI).
  if (ranked.size !== ai.dishes.length) return { ok: false, reason: "duplicate dish in ranking" };

  const best = ai.dishes[0];
  if (!best) return { ok: false, reason: "no best pick" };
  const want = intentAxis(mood);

  // (3) Quality floor — an ultra-processed / low-quality dish (Maggi, instant noodles, fries)
  // can never be the BEST pick when a better-quality, still-intent-aligned dish exists.
  const bestIsBad = isUltraProcessed(best.name) || attrs(best).quality === "low";
  if (bestIsBad) {
    const betterExists = ai.dishes.some(
      (d) => d.name !== best.name && !isUltraProcessed(d.name) && attrs(d).quality !== "low" && meetsWant(d, want),
    );
    if (betterExists) return { ok: false, reason: `low-quality best (${best.name}) over a better option` };
  }

  // (4) Intent alignment — the best pick must match a strong mood (reference-grounded).
  if (want === "sweet") {
    const anyDessert = menu.some((n) => classifyDish(n).kind === "dessert");
    const bestIsDessert = classifyDish(best.name).kind === "dessert";
    if (anyDessert && !bestIsDessert) return { ok: false, reason: "sweet mood but best pick isn't a dessert" };
    return { ok: true };
  }
  if (want && !meetsWant(best, want)) {
    return { ok: false, reason: `mood wants ${want.level} ${want.field} but best pick is ${attrs(best)[want.field]}` };
  }
  return { ok: true };
}

const TIER_MAP: Record<AIRanking["dishes"][number]["tier"], RankTier> = {
  best: "best",
  good: "good",
  heavier: "heavy",
};

/** Turn a validated AI ranking into the stable RankResult the verdict screen consumes.
 *  The AI owns the order/tiers/reasons; the classifier supplies kind/profile/signals so
 *  downstream (planFullMeal, etc.) still works. */
export function toRankResult(ai: AIRanking, menu: string[], ateToday?: string): RankResult {
  const n = ai.dishes.length;
  const step = n > 1 ? 90 / (n - 1) : 0;

  const all: RankedDish[] = ai.dishes.map((d, i) => {
    const dish = classifyDish(d.name);
    // Exactly one hero: the first dish is "best"; any other row the model also marked
    // "best" is demoted to "good" so the UI never sees two best picks.
    const tier: RankTier = i === 0 ? "best" : TIER_MAP[d.tier === "best" ? "good" : d.tier];
    return { ...dish, score: Math.round(100 - i * step), tier, chips: d.chips, reason: d.reason };
  });

  const best = all.length > 0 ? all[0] : null;
  const rest = all.slice(1);
  const heavier = rest.filter((d) => d.tier === "heavy").slice(0, 4);
  const heavySet = new Set(heavier);
  const alsoGood = rest.filter((d) => !heavySet.has(d)).slice(0, 4);

  return {
    best,
    alsoGood,
    heavier,
    all,
    goalLabel: ai.goalLabel,
    bestWhy: ai.bestWhy || (best ? best.reason : ""),
    ate: parseAte(ateToday ?? ""), // honour real "eaten today" input in the RankResult contract
    dishCount: n,
  };
}
