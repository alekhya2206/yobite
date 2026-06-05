// Dish classification: a cleaned name → a coarse, honest DishProfile + kind.

import type { Dish, DishKind, DishProfile } from "./types";
import {
  DESSERTS,
  DRINKS,
  FRIED_METHODS,
  LEAN_METHODS,
  LIGHT_CARBS,
  PROTEINS,
  REFINED_CARBS,
  RICH_HEAVY,
  RICH_MILD,
  VEG_SIGNALS,
  type ProteinToken,
} from "./knowledge";

/** Whole-word/phrase match against a normalized (spaces-padded, lowercased) name. */
function has(padded: string, phrase: string): boolean {
  // For multi-word phrases a substring check is fine; for single short tokens we
  // guard with spaces so "egg" doesn't match "eggplant"-style false positives.
  if (phrase.includes(" ")) return padded.includes(phrase);
  return padded.includes(` ${phrase} `);
}

function countMatches(padded: string, list: string[], signals: string[]): number {
  let n = 0;
  for (const phrase of list) {
    if (has(padded, phrase)) {
      n++;
      signals.push(phrase);
    }
  }
  return n;
}

function bestProtein(padded: string, signals: string[]): ProteinToken | null {
  let best: ProteinToken | null = null;
  for (const p of PROTEINS) {
    if (has(padded, p.match)) {
      signals.push(p.match);
      // Prefer the most specific / highest-protein hero ingredient.
      if (!best || p.grams > best.grams) best = p;
    }
  }
  return best;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function classifyKind(
  padded: string,
  carbWeight: number,
  protein: ProteinToken | null,
  vegScore: number,
  isDessert: boolean,
  isDrink: boolean,
): DishKind {
  if (isDrink) return "drink";
  if (isDessert) return "dessert";
  if (has(padded, "soup") || has(padded, "broth") || has(padded, "shorba")) return "soup";
  if (has(padded, "salad")) return "salad";
  // Pure bread / rice lines.
  const breadWords = ["naan", "roti", "kulcha", "paratha", "bhatura", "puri", "poori", "chapati", "bread"];
  const riceWords = ["rice", "biryani", "biriyani", "pulao", "pulav", "noodles", "pasta"];
  const hasProteinHero = !!protein;
  if (!hasProteinHero && breadWords.some((w) => has(padded, w))) return "bread";
  if (!hasProteinHero && riceWords.some((w) => has(padded, w))) return "rice";
  // Starters: small fried/grilled bites, tikka, kebab, wings, fingers...
  const starterWords = ["tikka", "kebab", "kabab", "wings", "fingers", "popcorn", "nuggets", "pakora", "pakoda", "65", "manchurian", "lollipop", "chilli", "satay", "spring roll", "samosa", "cutlet", "tots", "platter"];
  if (starterWords.some((w) => has(padded, w))) return "starter";
  if (vegScore > 0 && !hasProteinHero && carbWeight < 0.3) return "side";
  return "main";
}

/** Read one cleaned dish name into a full Dish (profile + kind + signals). */
export function classifyDish(name: string): Dish {
  const padded = ` ${name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
  const signals: string[] = [];

  const leanHits = countMatches(padded, LEAN_METHODS, signals);
  const friedHits = countMatches(padded, FRIED_METHODS, signals);
  const richHeavyHits = countMatches(padded, RICH_HEAVY, signals);
  const richMildHits = countMatches(padded, RICH_MILD, signals);
  const vegHits = countMatches(padded, VEG_SIGNALS, signals);

  // Drinks win over the generic "sweet" dessert signal (e.g. "Sweet Lassi").
  const isDrink = DRINKS.some((d) => has(padded, d));
  if (isDrink) signals.push("drink");
  const isDessert = !isDrink && DESSERTS.some((d) => has(padded, d));
  if (isDessert) signals.push("dessert");

  const protein = bestProtein(padded, signals);

  // Refined + light carb weights (take the strongest carb signal present).
  let refinedCarb = 0;
  for (const c of REFINED_CARBS) {
    if (has(padded, c.match)) {
      refinedCarb = Math.max(refinedCarb, c.weight);
      signals.push(c.match);
    }
  }
  let lightCarb = 0;
  for (const c of LIGHT_CARBS) {
    if (has(padded, c.match)) {
      lightCarb = Math.max(lightCarb, c.weight);
      signals.push(c.match);
    }
  }

  const fried = clamp01(friedHits * 0.6);
  const lean = clamp01(leanHits * 0.55 - fried * 0.5);
  const richness = clamp01(richHeavyHits * 0.55 + richMildHits * 0.28 + fried * 0.3);
  const vegScore = clamp01(vegHits * 0.4);

  const kind = classifyKind(padded, refinedCarb, protein, vegScore, isDessert, isDrink);

  // --- protein grams estimate -------------------------------------------------
  let proteinG = protein ? protein.grams : 0;
  // Salads / sides without a hero protein still have a little.
  if (!protein && (kind === "salad" || kind === "side")) proteinG = 5;
  if (kind === "dessert") proteinG = Math.min(proteinG, 5);
  if (kind === "drink") proteinG = has(padded, "lassi") || has(padded, "milkshake") || has(padded, "shake") ? 8 : 1;
  if (kind === "bread") proteinG = Math.max(proteinG, 6);
  if (kind === "rice" && !protein) proteinG = Math.max(proteinG, 7);
  if (kind === "soup" && !protein) proteinG = Math.max(proteinG, 4);
  // Fried prep shaves a touch off the usable-protein impression but it's still protein.

  // --- calorie estimate (coarse, relative-ranking only) -----------------------
  let calories = 280; // baseline light main
  calories += proteinG * 4;
  calories += refinedCarb * 320;
  calories += richness * 260;
  calories += fried * 180;
  calories -= lean * 90;
  calories -= vegScore * 60;
  if (kind === "dessert") calories = 380 + richness * 200;
  if (kind === "drink") calories = has(padded, "water") ? 0 : 120 + richness * 180;
  if (kind === "salad") calories = 210 + proteinG * 4 + richness * 120;
  if (kind === "soup") calories = 130 + proteinG * 4;
  calories = Math.max(40, Math.round(calories / 5) * 5);

  const vegetarian = !protein || !protein.animal;

  const profile: DishProfile = {
    proteinG: Math.round(proteinG),
    calories,
    refinedCarb: clamp01(Math.max(refinedCarb, lightCarb * 0.5)),
    richness,
    fried,
    lean,
    veg: vegScore,
    vegetarian,
  };

  return { name, kind, profile, signals: Array.from(new Set(signals)) };
}
