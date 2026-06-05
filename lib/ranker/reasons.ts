// Reason generation — "reasons over numbers."
//
// DESIGN.md: "'Grilled, high protein, lighter on refined carbs' beats a fake-precise
// calorie count. Honest beats impressive." Everything here is derived from the
// dish's own profile + context, never invented.

import type { AteContext, Dish, Goal } from "./types";

/** Up to 3 short positive chips for the hero pick. */
export function heroChips(dish: Dish): string[] {
  const p = dish.profile;
  const chips: string[] = [];

  if (p.proteinG >= 25) chips.push("High protein");
  else if (p.proteinG >= 16) chips.push("Good protein");

  if (p.lean >= 0.4 && p.fried < 0.2) chips.push("Grilled, not fried");
  else if (p.lean >= 0.3) chips.push("Lean cooking");

  if (p.refinedCarb < 0.3 && p.fried < 0.3) chips.push("Low refined carbs");
  else if (p.veg >= 0.4) chips.push("Veg-forward");

  if (chips.length < 3 && p.vegetarian && p.proteinG >= 14) chips.push("Veg & filling");
  if (chips.length < 3 && p.veg >= 0.4) chips.push("Light & fresh");
  if (chips.length === 0) chips.push("Balanced pick");

  return chips.slice(0, 3);
}

/** One short list-row reason ("Lean and grilled · skip the naan"). */
export function listReason(dish: Dish, ate: AteContext): string {
  const p = dish.profile;
  const left: string[] = [];

  if (p.proteinG >= 25) left.push("High protein");
  else if (p.proteinG >= 16) left.push("Good protein");
  else if (p.veg >= 0.4) left.push("Veg & light");
  else left.push("Lighter option");

  if (p.vegetarian && dish.kind !== "dessert" && p.proteinG >= 14 && !left[0].includes("Veg")) {
    left.push("veg");
  }
  if (p.lean >= 0.4 && p.fried < 0.2) left.push("grilled");

  const leftStr = left.join(", ");

  // Right side: the honest caveat or tip.
  let right = "";
  if (p.fried >= 0.4) right = "a little oily";
  else if (p.richness >= 0.45) right = "lighter than it sounds";
  else if (p.refinedCarb >= 0.6) right = ate.hadCarbs ? "you've had carbs today" : "skip the extra rice";
  else if (p.lean >= 0.4) right = "lean cooking";
  else if (p.veg >= 0.4) right = "lighter oil";
  else right = "solid all-rounder";

  return `${leftStr} · ${right}`;
}

/** A gentle, non-scolding reason for the heavier tier. */
export function heavierReason(dish: Dish, ate: AteContext): string {
  const p = dish.profile;
  if (dish.kind === "dessert") return "A proper treat · share it, savour it";
  if (dish.kind === "drink") return "Sip, don't make it the meal";
  if (p.fried >= 0.5) return "Deep-fried · order one for the table, not you";
  if (p.richness >= 0.5 && p.refinedCarb >= 0.5) return "Rich + carb-heavy · save it for a treat day";
  if (p.refinedCarb >= 0.6) {
    return ate.hadCarbs ? "Carb-heavy · you've already had rice today" : "Carb-heavy · easy on the portion";
  }
  if (p.richness >= 0.5) return "Rich, creamy · save it for a treat day";
  if (p.fried >= 0.3) return "A little heavy · not an everyday pick";
  return "Heavier · enjoy it now and then";
}

/** The hero's one-sentence "why" — goal-aware and context-aware. */
export function heroWhy(dish: Dish, goal: Goal, ate: AteContext): string {
  const p = dish.profile;
  const name = dish.name;
  const lean = p.lean >= 0.4 && p.fried < 0.2;
  const highProtein = p.proteinG >= 25;
  const lowCarb = p.refinedCarb < 0.3;

  // Context-first openers — these make the pick feel attentive.
  if (ate.hadCarbs && highProtein && lowCarb) {
    return "You already had your carbs earlier, so this keeps the protein high and the meal light without killing the fun.";
  }
  if (ate.hadFried && lean) {
    return "You've had something fried today, so this grilled pick balances the day out and still hits the spot.";
  }
  if (ate.hadRich && (lean || lowCarb)) {
    return "After something rich earlier, this is the lighter pick that won't sit heavy — and it still satisfies.";
  }

  // Goal-first fallbacks.
  if (goal.id === "high-protein") {
    if (highProtein && lean) return "Plenty of protein, cooked lean — this is exactly what you came here to order.";
    if (highProtein) return "Strong on protein for your goal, without going overboard on the heavy stuff.";
    return "The most protein-forward pick on this menu that still tastes like a treat.";
  }
  if (goal.id === "fat-loss") {
    if (lean && lowCarb) return "Lean, light on refined carbs, and genuinely filling — the easiest call for staying on track.";
    return "About as light as this menu gets while still being a real, satisfying meal.";
  }
  if (goal.id === "balanced") {
    return "A balanced plate — enough protein, not too heavy, and it actually sounds good.";
  }
  // custom
  if (highProtein && lean) return `${name} fits what you asked for — protein-forward and cleanly cooked.`;
  return `The closest match to what you asked for that still makes for a good meal.`;
}
