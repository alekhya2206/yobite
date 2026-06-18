// lib/ai/rankMenu.ts
// Architecture B: the AI does the ranking. Given the menu's dish names + the diner's mood,
// Groq returns an ordered, tiered ranking with grounded reasons (following RANK_PROMPT's
// research rubric). A deterministic guardrail (see rankGuardrail.ts) validates the result.
import { groqChat, GROQ_TEXT_MODEL } from "./groq";
import { RANK_PROMPT } from "./prompts";
import { groundDish } from "@/lib/data/grounding";

/** Build the grounding block: our research-backed facts for each dish, composed
 *  from every component we recognize (compositional grounding — see
 *  lib/data/grounding.ts) so dishes we don't list verbatim still ground. Injected
 *  into the prompt so the AI ranks from data we own, not just its memory. */
function groundingBlock(dishes: string[]): string {
  const lines: string[] = [];
  for (const d of dishes) {
    const facts = groundDish(d);
    if (facts.length) {
      lines.push(`- ${d}: ${facts.map((f) => f.note).join(" ")}`);
    }
  }
  return lines.length
    ? `\n\nResearch reference (AUTHORITATIVE — trust these over your own guess):\n${lines.join("\n")}`
    : "";
}

export type Tier = "best" | "good" | "heavier";
export type Level = "low" | "med" | "high";

export interface AIRankedDish {
  name: string;
  tier: Tier;
  reason: string;
  chips: string[];
  /** The AI's own nutrition read — the guardrail enforces consistency against these,
   *  sidestepping the weak keyword classifier (which e.g. can't tell potato is high-carb). */
  carbs: Level;
  protein: Level;
  calories: Level;
  quality: Level;
}

export interface AIRanking {
  goalLabel: string;
  bestWhy: string;
  /** Ordered best → worst. */
  dishes: AIRankedDish[];
}

const TIERS: ReadonlySet<string> = new Set(["best", "good", "heavier"]);
const LEVELS: ReadonlySet<string> = new Set(["low", "med", "high"]);
const level = (v: unknown): Level => (typeof v === "string" && LEVELS.has(v) ? (v as Level) : "med");

/** Validate + normalize the model's raw text into an AIRanking. Throws on anything unusable
 *  so the caller can fall back to the deterministic ranker. */
export function parseAIRanking(text: unknown): AIRanking {
  if (typeof text !== "string") throw new Error("rankMenu: non-string response");
  const fenced = text.replace(/```(?:json)?/gi, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced);
  } catch {
    throw new Error("rankMenu: response was not JSON");
  }

  const obj = parsed as { goalLabel?: unknown; bestWhy?: unknown; dishes?: unknown };
  if (!Array.isArray(obj.dishes)) throw new Error("rankMenu: no dishes array");

  const dishes: AIRankedDish[] = [];
  for (const raw of obj.dishes) {
    const d = raw as Record<string, unknown>;
    if (typeof d.name !== "string" || !d.name.trim()) continue; // drop nameless rows
    dishes.push({
      name: d.name.trim(),
      tier: typeof d.tier === "string" && TIERS.has(d.tier) ? (d.tier as Tier) : "heavier",
      reason: typeof d.reason === "string" ? d.reason.trim() : "",
      chips: Array.isArray(d.chips) ? d.chips.filter((c): c is string => typeof c === "string").slice(0, 3) : [],
      carbs: level(d.carbs),
      protein: level(d.protein),
      calories: level(d.calories),
      quality: level(d.quality),
    });
  }
  if (dishes.length === 0) throw new Error("rankMenu: no usable dishes");

  return {
    goalLabel: typeof obj.goalLabel === "string" && obj.goalLabel.trim() ? obj.goalLabel.trim() : "Your pick",
    bestWhy: typeof obj.bestWhy === "string" ? obj.bestWhy.trim() : "",
    dishes,
  };
}

export type RankMenu = (dishes: string[], mood: string, ateToday?: string) => Promise<AIRanking>;

interface Deps {
  apiKey: string;
  fetchFn?: typeof fetch;
  model?: string;
  timeoutMs?: number;
}

export function makeGroqRankMenu({ apiKey, fetchFn, model = GROQ_TEXT_MODEL, timeoutMs = 20000 }: Deps): RankMenu {
  return async (dishes, mood, ateToday) => {
    const ate = ateToday?.trim() ? `\nAlready eaten today (balance against this): ${ateToday.trim()}` : "";
    const user =
      `Diner's mood for this meal: ${JSON.stringify(mood || "just the best option")}.${ate}\n` +
      `Menu (rank ALL of these, exact names):\n${dishes.map((d) => `- ${d}`).join("\n")}` +
      groundingBlock(dishes);
    const out = await groqChat({
      apiKey,
      model,
      messages: [
        { role: "system", content: RANK_PROMPT },
        { role: "user", content: user },
      ],
      fetchFn,
      timeoutMs,
    });
    return parseAIRanking(out);
  };
}
