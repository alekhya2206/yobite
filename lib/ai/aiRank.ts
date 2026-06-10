// lib/ai/aiRank.ts
// Orchestrates Architecture B: AI ranking → strict guardrail → one corrective retry →
// deterministic fallback. The result is always a valid RankResult.
import { makeGroqRankMenu, type RankMenu } from "./rankMenu";
import { applyDietFilter, checkRanking, toRankResult } from "./rankGuardrail";
import { classifyGoal } from "./intent";
import { rank } from "@/lib/ranker";
import type { RankResult } from "@/lib/ranker/types";

type Fallback = (dishes: string[], mood: string, ateToday?: string) => RankResult;

interface Deps {
  rankMenu: RankMenu;
  fallback: Fallback;
}

/** Pure, injectable core — easy to test. */
export function makeAIRank({ rankMenu, fallback }: Deps) {
  return async (allDishes: string[], mood: string, ateToday?: string): Promise<RankResult> => {
    // Hard dietary constraint (e.g. "veg only") removes ineligible dishes before ranking.
    const dishes = applyDietFilter(allDishes, mood);
    try {
      let ai = await rankMenu(dishes, mood, ateToday);
      let verdict = checkRanking(ai, dishes, mood);

      if (!verdict.ok) {
        // One corrective retry: tell the model exactly what it got wrong.
        const corrected = `${mood}\n\nIMPORTANT: your previous answer was rejected because ${verdict.reason}. The TOP pick MUST clearly match the diner's mood. Fix it.`;
        ai = await rankMenu(dishes, corrected, ateToday);
        verdict = checkRanking(ai, dishes, mood);
      }

      if (verdict.ok) return toRankResult(ai, dishes, ateToday);
      console.warn("[aiRank] guardrail rejected AI ranking twice, using deterministic:", verdict.reason);
      return fallback(dishes, mood, ateToday);
    } catch (err) {
      console.warn("[aiRank] AI ranking failed, using deterministic:", err);
      return fallback(dishes, mood, ateToday);
    }
  };
}

/** The deterministic safety net: the existing rule-based ranker. */
export function deterministicRank(dishes: string[], mood: string, ateToday?: string): RankResult {
  return rank({ menuText: dishes.join("\n"), goal: classifyGoal(mood), ateToday });
}

/** Build the real ranker from env. Groq primary; deterministic fallback. */
export function aiRankFromEnv() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    // No AI key — deterministic only (still honours the hard veg filter).
    return async (dishes: string[], mood: string, ateToday?: string) =>
      deterministicRank(applyDietFilter(dishes, mood), mood, ateToday);
  }
  return makeAIRank({ rankMenu: makeGroqRankMenu({ apiKey: key }), fallback: deterministicRank });
}
