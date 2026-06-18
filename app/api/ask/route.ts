// app/api/ask/route.ts
// Phase 2 — answers a diner's question about the menu they already ranked.
// Groq answers in-context (LLM-in-context, no retrieval corpus); the instant local
// answer (askYoBite) is the offline/no-key/failure fallback, mirroring /api/rank.
import { makeGroqAskMenu } from "@/lib/ai/askMenu";
import { askYoBite } from "@/lib/ranker/ask";
import type { RankResult } from "@/lib/ranker/types";

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

  // The result is the ranking the client already holds, round-tripping back to us.
  const result = body.result as RankResult | undefined;
  if (!result || typeof result !== "object" || !Array.isArray(result.all)) {
    return Response.json({ error: "result must be the ranked menu" }, { status: 400 });
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
