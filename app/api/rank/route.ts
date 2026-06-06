// app/api/rank/route.ts
import { rank } from "@/lib/ranker";
import { classifyGoal } from "@/lib/ai/intent";
import type { Goal, GoalId } from "@/lib/ranker/types";

export async function POST(req: Request): Promise<Response> {
  let body: { dishes?: unknown; goalText?: string; goalId?: GoalId; ateToday?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.dishes) || body.dishes.length === 0) {
    return Response.json({ error: "dishes[] is required" }, { status: 400 });
  }

  // A per-meal goalId (from the user's saved goal) wins; otherwise parse free text;
  // empty/skip falls back to balanced (handled inside classifyGoal).
  const goal: Goal = body.goalId ? { id: body.goalId } : classifyGoal(body.goalText ?? "");

  const result = rank({
    menuText: (body.dishes as string[]).join("\n"),
    goal,
    ateToday: body.ateToday,
  });
  return Response.json(result);
}
