# `lib/ai/` — AI providers + orchestration (🟦 backend, server-only)

The AI layer behind `/api/scan`, `/api/rank`, `/api/ask`. **Architecture B**: the
AI does the work, a strict deterministic guardrail can veto it, and `lib/ranker`
is the always-valid fallback. These modules assume server env (`process.env`
keys) — **do not import from client components** (the pure helpers marked ⬜ are
the exception).

## Providers (raw LLM calls)
| File | Role |
|------|------|
| `groq.ts` | **Primary** provider (OpenAI-compatible). Vision (menu photo) + text (rank/ask). Real free tier, fast. |
| `gemini.ts` | Gemini Flash provider — vision + text fallback. |
| `openrouter.ts` | OpenRouter (Qwen-VL) — extra vision fallback. |
| `withFallback.ts` | Run primary; on throw, run fallback (null fallback ⇒ error propagates). |
| `types.ts` | Provider contracts + `ProviderError`. |
| `prompts.ts` | Shared prompts (menu-read, rank rubric, ask) so every provider behaves identically. |

## Menu reading (`/api/scan`)
| File | Role |
|------|------|
| `readMenu.ts` | `readMenuFromEnv` — vision orchestration: Groq → Gemini/OpenRouter fallback, then parse + normalize. |
| `parseDishList.ts` | ⬜ LLM output → raw dish names (JSON-first, tolerant of ```json fences). |
| `normalizeDishes.ts` | ⬜ Clean an untrusted dish list (drop blanks/dupes/non-strings, cap length). |

## Ranking (`/api/rank`)
| File | Role |
|------|------|
| `aiRank.ts` | Orchestrates Architecture B: AI rank → guardrail → one corrective retry → deterministic fallback. `aiRankFromEnv` builds the real thing. |
| `rankMenu.ts` | The Groq ranking call: dishes + mood + **grounding block** (`lib/data/grounding`) → tiered, reasoned JSON. |
| `rankGuardrail.ts` | The STRICT deterministic safety net — validates/repairs the AI ranking; applies hard diet filters. |
| `intent.ts` | ⬜ Deterministic free-text → `Goal` (`classifyGoal`). Used as the mood/goal classifier + fallback. |

## Q&A (`/api/ask`, Phase 2)
| File | Role |
|------|------|
| `askMenu.ts` | LLM-in-context Q&A (NOT RAG): answers using only the dishes already ranked + their grounding. |
