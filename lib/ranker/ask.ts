// "Ask YoBite" — a small, honest, local Q&A over the dishes we already ranked.
// No model call: it reads the question's intent and answers from the menu in hand.
// Better to give a real, grounded answer to the common asks than a fake-smart one.

import type { RankResult, RankedDish } from "./types";

function names(list: RankedDish[], n = 3): string {
  const picks = list.slice(0, n).map((d) => d.name);
  if (picks.length === 0) return "";
  if (picks.length === 1) return picks[0];
  return `${picks.slice(0, -1).join(", ")} or ${picks[picks.length - 1]}`;
}

export function askYoBite(question: string, result: RankResult): string {
  const q = question.toLowerCase().trim();
  if (!q) return "Ask me anything about this menu — veg options, something lighter, good starters…";

  const all = result.all;
  const veg = all.filter((d) => d.profile.vegetarian);

  const wantsVeg = /\bveg\b|vegetarian|vegan|no meat|plant/.test(q) && !/non[\s-]?veg/.test(q);
  const wantsStarter = /starter|appetiz|snack|small plate|to begin|begin with/.test(q);
  const wantsLight = /light|lighter|low cal|less heavy|not heavy|healthy|lean/.test(q);
  const wantsProtein = /protein|filling|muscle|gym|post[\s-]?workout/.test(q);
  const wantsDessert = /dessert|sweet|something sweet|after meal/.test(q);
  const wantsDrink = /drink|beverage|thirsty|to drink/.test(q);
  const wantsSpicy = /spicy|hot|chilli|chili/.test(q);

  let pool = wantsVeg ? veg : all;

  if (wantsStarter) {
    const starters = pool.filter((d) => d.kind === "starter" || d.kind === "soup" || d.kind === "salad");
    return starters.length
      ? `Good ${wantsVeg ? "veg " : ""}starters here: ${names(starters)}. ${starters[0].reason}.`
      : `Honestly, nothing on this menu reads as a great ${wantsVeg ? "veg " : ""}starter — I'd jump straight to ${result.best?.name ?? "the main"}.`;
  }
  if (wantsDessert) {
    const desserts = all.filter((d) => d.kind === "dessert");
    return desserts.length
      ? `If you're treating yourself: ${names(desserts)}. Share it and savour it rather than making it the meal.`
      : `No desserts jumped out on this menu — nothing to feel guilty about skipping.`;
  }
  if (wantsDrink) {
    const drinks = all.filter((d) => d.kind === "drink");
    return drinks.length
      ? `Drinks-wise: ${names(drinks)}. Go easy if you're watching the day — liquid calories add up quietly.`
      : `I don't see drinks listed here.`;
  }
  if (wantsProtein) {
    const byProtein = [...pool].sort((a, b) => b.profile.proteinG - a.profile.proteinG);
    return byProtein.length
      ? `Most protein for your goal: ${names(byProtein)}. ${byProtein[0].name} leads at ~${byProtein[0].profile.proteinG}g.`
      : `Nothing here is especially protein-rich, to be honest.`;
  }
  if (wantsLight) {
    const light = pool.filter((d) => d.tier !== "heavy" && d.kind !== "dessert" && d.kind !== "drink");
    return light.length
      ? `Lighter ${wantsVeg ? "veg " : ""}picks: ${names(light)}. ${light[0].reason}.`
      : `This menu runs heavy — the lightest call is probably ${result.best?.name ?? "the top pick"}.`;
  }
  if (wantsVeg) {
    const goodVeg = veg.filter((d) => d.tier !== "heavy");
    return goodVeg.length
      ? `Solid veg options: ${names(goodVeg)}. ${goodVeg[0].reason}.`
      : veg.length
        ? `The veg choices here lean heavy, but ${veg[0].name} is the pick of them.`
        : `This menu is pretty meat-forward — slim pickings on the veg side.`;
  }
  if (wantsSpicy) {
    return `I rank by how a dish fits your goal, not heat — but ${result.best?.name ?? "the top pick"} is a safe, tasty call. Ask the kitchen to spice it up.`;
  }

  // Default: re-affirm the pick.
  return result.best
    ? `For your goal, I'd still order ${result.best.name} — ${result.bestWhy.replace(/\.$/, "")}.`
    : `Paste the menu and I'll give you a pick.`;
}
