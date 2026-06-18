// lib/data/grounding.ts
// Compositional grounding — NOT a RAG pipeline.
//
// Indian/Indo-Chinese menu dishes are compositional ([style] + [protein] +
// [method] + [carb base]), so we ground a dish by DECOMPOSING its name and
// composing cited facts from every component we recognize — instead of needing
// the whole dish pre-listed in FOOD_REFERENCE. Deterministic, offline, free, and
// traceable (each fact says exactly what it grounded on). Embeddings/vector
// search are deferred behind this same interface; see the Phase 1 design doc.

import { FOOD_REFERENCE } from "./foodReference";
import { FRIED_METHODS } from "@/lib/ranker/knowledge";

export interface GroundingFact {
  /** The phrase/component this fact grounded on (for traceability). */
  match: string;
  /** The cited nutrition note served to the AI as authoritative grounding. */
  note: string;
  /** "exact" = a verbatim FOOD_REFERENCE row; "component" = a recognized part. */
  source: "exact" | "component";
}

const MAX_FACTS = 4;

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word/phrase test with an optional plural suffix — mirrors lookupFood. */
const phraseIn = (phrase: string, text: string): boolean =>
  new RegExp(`(^| )${escapeRe(phrase)}(es|s)?( |$)`).test(text);

/** Misspellings / regional variants → canonical phrases the tables recognize. */
const SYNONYMS: [RegExp, string][] = [
  [/\bpanir\b/g, "paneer"],
  [/\bchowmein\b/g, "chow mein"],
  [/\bchow mien\b/g, "chow mein"],
  [/\bbiriyani\b/g, "biryani"],
];

/** Component facts: emitted only when no exact row already covers that family,
 *  so a dish we don't list verbatim still grounds on what we DO recognize. */
interface Component {
  test: (t: string) => boolean;
  match: string;
  note: string;
}

const COMPONENTS: Component[] = [
  {
    test: (t) => /(^| )(noodle|noodles|chow mein|hakka|maggi)( |$)/.test(t),
    match: "noodles",
    note: "Refined-flour (maida) noodles, usually oil-fried — low fibre, high GI.",
  },
  {
    test: (t) => /(^| )(fried rice|pulao|pulav|biryani)( |$)/.test(t),
    match: "rice dish",
    note: "Refined white rice cooked with oil — energy-dense, higher GI than whole grains.",
  },
  {
    test: (t) => FRIED_METHODS.some((m) => phraseIn(m, t)),
    match: "fried",
    note: "Deep-fried / battered — an oil-heavy cooking method that adds fat and calories.",
  },
];

const normalize = (raw: string): string => {
  let t = clean(raw);
  for (const [re, to] of SYNONYMS) t = t.replace(re, to);
  return t.replace(/\s+/g, " ").trim();
};

/** Ground a dish name → cited facts to inject as authoritative grounding. */
export function groundDish(name: string): GroundingFact[] {
  const t = normalize(name);
  if (!t) return [];

  const facts: GroundingFact[] = [];

  // 1. Exact facts: every FOOD_REFERENCE phrase present, longest first. Skip a
  //    shorter phrase already contained in an accepted longer one ("grilled"
  //    when "grilled chicken" is already in).
  const exact = FOOD_REFERENCE.filter((r) => phraseIn(r.match, t)).sort((a, b) => b.match.length - a.match.length);
  for (const r of exact) {
    if (facts.some((f) => phraseIn(r.match, clean(f.match)))) continue;
    facts.push({ match: r.match, note: r.note, source: "exact" });
  }

  // 2. Component fill — add only families not already grounded by an exact fact.
  for (const c of COMPONENTS) {
    if (!c.test(t)) continue;
    if (facts.some((f) => c.test(` ${clean(f.match)} `))) continue;
    facts.push({ match: c.match, note: c.note, source: "component" });
  }

  return facts.slice(0, MAX_FACTS);
}
