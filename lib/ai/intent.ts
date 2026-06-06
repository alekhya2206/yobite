// lib/ai/intent.ts
import type { Goal } from "@/lib/ranker/types";

// Deterministic free-text → Goal. Order matters: protein > fat-loss > balanced.
// Unrecognized but non-empty text becomes a custom goal (the ranker handles custom text).
export function classifyGoal(text: string): Goal {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return { id: "balanced" };

  if (/\bprotein\b|muscle|gain|bulk/.test(t)) return { id: "high-protein" };
  if (/lose|weight|light|lean|cut|fat[- ]?loss|low[- ]?cal|diet/.test(t)) return { id: "fat-loss" };
  if (/balanc|normal|regular|whatever|moderate/.test(t)) return { id: "balanced" };

  return { id: "custom", custom: text.trim() };
}
