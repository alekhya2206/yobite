// lib/preferences/goalToMood.ts
// Phrase the user's universal profile goal as a mood sentence, so "Skip — use my usual goal"
// feeds the AI ranker the same way a typed mood does.
import type { Goal } from "@/lib/ranker/types";

const PHRASES: Record<string, string> = {
  "high-protein": "high protein",
  "fat-loss": "light, fewer calories",
  balanced: "a balanced meal",
};

export function goalToMood(goal: Goal): string {
  if (goal.id === "custom") return goal.custom?.trim() || PHRASES.balanced;
  return PHRASES[goal.id] ?? PHRASES.balanced;
}
