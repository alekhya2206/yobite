// app/api/ask/route.ts
// Phase 2 — answers a diner's question about the menu they already ranked.
// Groq answers in-context (LLM-in-context, no retrieval corpus); the instant local
// answer (askYoBite) is the offline/no-key/failure fallback, mirroring /api/rank.
import { makeGroqAskMenu } from "@/lib/ai/askMenu";
import { askYoBite } from "@/lib/ranker/ask";
import type { RankResult, RankedDish } from "@/lib/ranker/types";

const MAX_QUESTION_CHARS = 1000;
const MAX_DISHES = 200;

/** A dish the consumers can safely read: a name string + a profile object
 *  (askYoBite / buildAskContext dereference d.name and d.profile.*). */
function isWellFormedDish(d: unknown): d is RankedDish {
  return (
    !!d &&
    typeof d === "object" &&
    typeof (d as RankedDish).name === "string" &&
    typeof (d as RankedDish).profile === "object" &&
    (d as RankedDish).profile !== null
  );
}

export async function POST(req: Request): Promise<Response> {
  let body: { question?: unknown; result?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "question must be a non-empty string" }, { status: 400 });
  }
  // Bound untrusted input on this LLM-backed route (cost/abuse guard).
  if (question.length > MAX_QUESTION_CHARS) {
    return Response.json({ error: "question is too long" }, { status: 400 });
  }

  // The result is the ranking the client already holds, round-tripping back to us.
  // It's untrusted: validate the shape the consumers actually dereference, so a
  // malformed body returns 400 instead of crashing into an unhandled 500.
  const result = body.result as RankResult | undefined;
  if (!result || typeof result !== "object" || !Array.isArray(result.all)) {
    return Response.json({ error: "result must be the ranked menu" }, { status: 400 });
  }
  if (result.all.length > MAX_DISHES) {
    return Response.json({ error: "result has too many dishes" }, { status: 400 });
  }
  if (!result.all.every(isWellFormedDish)) {
    return Response.json({ error: "result dishes are malformed" }, { status: 400 });
  }
  if (result.best != null && typeof result.bestWhy !== "string") {
    return Response.json({ error: "result is malformed" }, { status: 400 });
  }

  const key = process.env.GROQ_API_KEY;
  if (key) {
    try {
      const answer = await makeGroqAskMenu({ apiKey: key })(question, result);
      return Response.json({ answer });
    } catch (err) {
      // Fall through to the instant local answer.
      console.warn("[ask] LLM answer failed, using local:", err);
    }
  }

  return Response.json({ answer: askYoBite(question, result) });
}
