# `lib/` — application logic

All non-UI logic, grouped by domain. Layers (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md)):
🟦 backend (server-only, may use API keys) · 🟩 frontend (browser) · ⬜ shared
(pure, no network/secrets).

| Domain | Layer | What it is |
|--------|-------|-----------|
| [`ai/`](ai/README.md) | 🟦 backend | LLM providers + AI orchestration (read menu, rank, ask, guardrail). |
| [`data/`](data/README.md) | 🟦 backend | Owned food reference + compositional grounding. |
| [`ranker/`](ranker/README.md) | ⬜ shared core | Deterministic rule-based ranking brain + types. |
| `meal/` | 🟩 frontend | `planFullMeal.ts` — deterministic full-meal planner: groups ranked dishes into a balanced plate for the order screen. |
| `preferences/` | 🟩 frontend | `goalToMood.ts` — phrases the diner's saved profile goal as a mood sentence ("use my usual goal"). |
| `scan/` | 🟩 frontend | `postScan.ts` — client → `/api/scan` helper (downscaling happens in the Scan screen first). |
| `storage/` | 🟩 frontend | `index.ts` + `types.ts` — typed, SSR-safe `localStorage`; the single client source of truth for session + profile. |

## Loose files (frontend)
| File | Role |
|------|------|
| `voice.ts` | Voice input via the Web Speech API; tiny, degrades silently where unsupported. |
| `useVoiceInput.ts` | React hook wrapping `voice.ts` — the single mic wiring used by Scan + Intent. |

> Tests are co-located as `*.test.ts[x]`. The domain folders with multiple files
> (`ai`, `data`, `ranker`) have their own README.
