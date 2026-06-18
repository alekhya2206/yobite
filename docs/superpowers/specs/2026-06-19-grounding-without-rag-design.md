# Grounding without RAG — Phase 1 & 2 design

**Date:** 2026-06-19
**Branch:** `phase1-compositional-grounding`
**Decision:** Achieve "ground the AI in data we own" via compositional lexical
retrieval over structured data — **not** an embeddings/vector RAG pipeline.
RAG is over-engineering for structured, owned nutrition data; it only earns its
keep on transliteration / regional-spelling drift, which is deferred behind the
same interface.

## Problem

`groundingBlock()` in `lib/ai/rankMenu.ts` grounds the ranker by calling
`lookupFood(dish)` — which returns the **single longest whole-phrase** match in
`FOOD_REFERENCE` (~45 rows). Compositional dishes that aren't pre-listed verbatim
(e.g. "Schezwan Chilli Garlic Noodles") return `null` → **no grounding** → the AI
falls back to its own memory, the exact "mood not data" failure grounding exists
to prevent.

Indian/Indo-Chinese menu dishes are compositional: `[style] + [protein] +
[method] + [carb base]`. So we ground by **decomposing the name and composing
cited facts from every component we recognize**, instead of needing the whole
dish pre-listed.

## Phase 1 — Compositional grounding (no RAG)

### Modules
- **`lib/data/grounding.ts`** (new) — the one public entry point.
  - `groundDish(name: string): GroundingFact[]` — returns 0..N cited facts.
  - `GroundingFact = { match: string; note: string; source: "exact" | "component" | "signal" }`.
  - Algorithm:
    1. **Normalize** the name (lowercase, strip punctuation) and apply a small
       **synonym map** (`SYNONYMS`): regional/Indo-Chinese style words →
       canonical `FOOD_REFERENCE` phrases (e.g. `schezwan|manchurian|hakka|
       chowmein → "chow mein"`, `panir → "paneer"`, `chilli chicken → "fried chicken"`).
    2. **Exact/whole-phrase facts:** collect **all** `FOOD_REFERENCE` rows whose
       `match` appears as a whole word/phrase in the normalized name (not just the
       longest). `source: "exact"`.
    3. **Component fill:** for component categories not already covered by an exact
       fact, emit an honest fact from the `knowledge.ts` token tables
       (`FRIED_METHODS`, `LEAN_METHODS`, `RICH_HEAVY`, `REFINED_CARBS`, etc.) —
       e.g. a fried method → "deep-fried, oil-heavy cooking method". `source: "component"`.
    4. **Dedupe + cap** at 4 facts, ordered exact → component, longest match first,
       so the prompt stays tight and the most specific facts win.
  - Pure, deterministic, no network, offline. Reuses existing data; adds the
    `SYNONYMS` map (~30 lines) and component-fact templates.
- **`lib/data/foodReference.ts`** — unchanged. `lookupFood()` kept as-is (still
  used/tested); `groundDish` builds on top of `FOOD_REFERENCE` + `lookupFood`.

### Integration
`groundingBlock()` in `rankMenu.ts` switches from `lookupFood` (one fact) to
`groundDish` (composed facts). Output format and the "AUTHORITATIVE …" framing are
preserved, so the prompt contract, the guardrail (`rankGuardrail.ts`), and its
tests are untouched. Net effect: near-total dish coverage with traceable facts.

### Tests (written first, TDD)
- `lib/data/grounding.test.ts`:
  - unknown compositional dish ("Schezwan Chilli Garlic Noodles") now returns ≥1
    fact citing refined-flour/oil/high-GI (regression for the core bug).
  - synonym resolution ("Panir Tikka" → paneer fact; "Hakka Noodles" → chow mein).
  - composition (a dish with protein + carb + method yields multiple facts, capped).
  - a dish with no recognizable component returns `[]` (no fabricated facts).
  - exact-listed dishes still resolve (no regression vs `lookupFood`).
- `rankMenu.test.ts` — extend: grounding block contains component facts for an
  unlisted dish.

### Definition of done (Phase 1)
`vitest` all green, `tsc --noEmit` clean, `next build` green, and an end-to-end
check: a menu containing an unlisted compositional dish produces a grounding block
with cited facts (verified by running the ranker path).

## Phase 2 — Conversational Q&A (LLM-in-context, no RAG)

Today `lib/ranker/ask.ts` (`askYoBite`) answers from local pattern-matching over
the already-ranked dishes. Phase 2 adds an LLM-backed answer for free-form
questions, grounded by the dishes already in hand (no corpus to search).

### Modules
- **`lib/ai/askMenu.ts`** (new) — `makeGroqAskMenu({apiKey,...}): (question,
  context) => Promise<string>`. Prompt = the ranked dishes + their grounded facts
  + the diner's goal; returns a short, grounded, plain-text answer. Mirrors
  `rankMenu.ts`'s dependency-injection shape and timeouts.
- **`app/api/ask/route.ts`** (new) — `POST {question, ranking}` → `{answer}`.
  Falls back to local `askYoBite` when there's no API key or the call fails
  (same graceful-degradation pattern as `/api/rank`).
- **Order page** — the ask UI calls `/api/ask`; the instant local answer remains
  as the offline fallback.

### Tests (written first, TDD)
- `lib/ai/askMenu.test.ts` — builds a grounded prompt from context; parses a
  plain-text answer; throws on empty so the route can fall back.
- `app/api/ask/route.test.ts` — returns the LLM answer when keyed; falls back to
  `askYoBite` with no key / on error.

### Definition of done (Phase 2)
Same green loop (`vitest` + `tsc` + `next build`) and an end-to-end check that the
ask endpoint returns a grounded answer with a key and the local fallback without.

## Non-goals / deferred
- Embeddings, vector store, pgvector, Supabase — deferred. Trigger to revisit:
  transliteration/regional-spelling drift that lexical + synonyms can't cover.
- Phase 3 (diner/restaurant memory) — gated on Supabase auth/DB (Plan 3);
  relational fetch, not vector search.
- No changes to the deterministic ranker scoring, the guardrail rubric, or the
  design system.
