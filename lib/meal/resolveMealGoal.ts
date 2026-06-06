// lib/meal/resolveMealGoal.ts
// The per-meal goal: free text wins; empty falls back to the universal profile
// goal (the "skip" path). The profile goal is not a law for every meal.
import { classifyGoal } from "@/lib/ai/intent";
import type { Goal } from "@/lib/ranker/types";

export function resolveMealGoal(text: string, profileGoal: Goal): Goal {
  if (!text || !text.trim()) return profileGoal;
  return classifyGoal(text);
}
