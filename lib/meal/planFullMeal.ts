// lib/meal/planFullMeal.ts
// Deterministic full-meal planner (NOT a chatbot): group the ranked dishes by
// course and take the best of each. rank().all is already sorted best→worst,
// so the first dish matching a course is that course's best pick.
import type { DishKind, RankResult, RankedDish } from "@/lib/ranker/types";

export type Course = "starter" | "main" | "dessert";

export interface FullMeal {
  starter: RankedDish | null;
  main: RankedDish | null;
  dessert: RankedDish | null;
}

const COURSE_OF: Partial<Record<DishKind, Course>> = {
  starter: "starter", salad: "starter", soup: "starter",
  main: "main", rice: "main",
  dessert: "dessert",
  // bread, side, drink: not a standalone course in the planner
};

export function planFullMeal(result: RankResult): FullMeal {
  const meal: FullMeal = { starter: null, main: null, dessert: null };
  for (const dish of result.all) {
    const course = COURSE_OF[dish.kind];
    if (course && meal[course] === null) {
      meal[course] = dish;
    }
  }
  return meal;
}
