// app/api/rank/route.ts
// Ranks a menu for the diner's mood using Architecture B: the AI does the ranking,
// a strict deterministic guardrail validates it, and the rule-based ranker is the fallback.
import { aiRankFromEnv } from "@/lib/ai/aiRank";
import { normalizeDishes } from "@/lib/ai/normalizeDishes";

export async function POST(req: Request): Promise<Response> {
  let body: { dishes?: unknown; mood?: unknown; ateToday?: unknown };
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

  const mood = typeof body.mood === "string" ? body.mood : "";
  const ateToday = typeof body.ateToday === "string" ? body.ateToday : undefined;

  const result = await aiRankFromEnv()(dishes, mood, ateToday);
  return Response.json(result);
}
