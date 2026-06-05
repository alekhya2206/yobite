// Tiny session handoff between the input screen and the result screen.
//
// We store the raw RankInput (not the result) and re-run the brain on the result
// page — rank() is pure and fast, so this keeps a single source of truth and
// survives a refresh. No backend, no accounts: a menu decision shouldn't need one.

import type { RankInput } from "./ranker/types";

const KEY = "yobite:lastInput";

export function saveInput(input: RankInput): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(input));
  } catch {
    /* storage may be unavailable (private mode); the demo fallback covers it */
  }
}

export function loadInput(): RankInput | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RankInput) : null;
  } catch {
    return null;
  }
}

/** The menu used for the landing-page preview and any direct visit to /order. */
export const DEMO_INPUT: RankInput = {
  menuText: [
    "Grilled Chicken Tikka",
    "Paneer Tikka Salad",
    "Tandoori Fish",
    "Chicken 65",
    "Dal Tadka",
    "Palak Paneer",
    "Chicken Manchurian (dry)",
    "Butter Chicken",
    "Chicken Biryani",
    "Hakka Noodles",
    "Cheese Garlic Naan",
    "Gulab Jamun",
  ].join("\n"),
  goal: { id: "high-protein" },
  ateToday: "rice and dal at lunch",
};
