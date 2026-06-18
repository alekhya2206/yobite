// lib/ai/askMenu.ts
// Phase 2 — Conversational Q&A, LLM-in-context (NOT RAG). The diner is looking at
// one menu we already ranked; there's no corpus to search. We hand the model the
// ranked dishes + their grounded facts (from compositional grounding) and let it
// answer the free-form question. The caller falls back to the instant local
// answer (askYoBite) when there's no key or the call fails.
import { groqChat, GROQ_TEXT_MODEL } from "./groq";
import { ASK_PROMPT } from "./prompts";
import { groundDish } from "@/lib/data/grounding";
import type { RankResult } from "@/lib/ranker/types";

export type AskMenu = (question: string, result: RankResult) => Promise<string>;

/** Compact, grounded context: every ranked dish with its reason + cited facts. */
export function buildAskContext(result: RankResult): string {
  return result.all
    .map((d) => {
      const facts = groundDish(d.name).map((f) => f.note).join(" ");
      const tail = facts ? ` Facts: ${facts}` : "";
      return `- ${d.name} [${d.tier}, ~${d.profile.proteinG}g protein]: ${d.reason}.${tail}`;
    })
    .join("\n");
}

interface Deps {
  apiKey: string;
  fetchFn?: typeof fetch;
  model?: string;
  timeoutMs?: number;
}

export function makeGroqAskMenu({ apiKey, fetchFn, model = GROQ_TEXT_MODEL, timeoutMs = 15000 }: Deps): AskMenu {
  return async (question, result) => {
    const user =
      `Diner's goal: ${result.goalLabel || "no specific goal"}.\n` +
      `Dishes already ranked for them (best → worst):\n${buildAskContext(result)}\n\n` +
      `Diner asks: ${JSON.stringify(question)}`;
    const out = await groqChat({
      apiKey,
      model,
      messages: [
        { role: "system", content: ASK_PROMPT },
        { role: "user", content: user },
      ],
      fetchFn,
      timeoutMs,
    });
    const answer = out.trim();
    if (!answer) throw new Error("askMenu: empty answer");
    return answer;
  };
}
