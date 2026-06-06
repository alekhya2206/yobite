// app/api/rank/route.ts
import { rank } from "@/lib/ranker";
import { classifyGoal } from "@/lib/ai/intent";
import { normalizeDishes } from "@/lib/ai/normalizeDishes";
import type { Goal, GoalId } from "@/lib/ranker/types";

const VALID_GOALS: ReadonlySet<string> = new Set([
  "high-protein",
  "fat-loss",
  "balanced",
  "custom",
]);

export async function POST(req: Request): Promise<Response> {
  let body: { dishes?: unknown; goalText?: string; goalId?: unknown; ateToday?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // The body is untrusted: normalizeDishes drops non-strings/blanks/dupes and caps length.
  const dishes = normalizeDishes(body.dishes);
  if (dishes.length === 0) {
    return Response.json(
      { error: "dishes must be a non-empty array of dish names" },
      { status: 400 },
    );
  }

  // goalId is arbitrary JSON at runtime — reject anything outside the known set so we
  // never hand the ranker an unknown goal (which would yield an undefined label).
  if (body.goalId !== undefined && !VALID_GOALS.has(body.goalId as string)) {
    return Response.json(
      { error: `Invalid goalId. Use one of: ${[...VALID_GOALS].join(", ")}` },
      { status: 400 },
    );
  }

  // A valid per-meal goalId (from the user's saved goal) wins; otherwise parse the free
  // text; empty/skip falls back to balanced (handled inside classifyGoal).
  const goal: Goal = body.goalId
    ? { id: body.goalId as GoalId }
    : classifyGoal(body.goalText ?? "");

  const result = rank({ menuText: dishes.join("\n"), goal, ateToday: body.ateToday });
  return Response.json(result);
}
