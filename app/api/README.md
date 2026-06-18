# `app/api/` — backend HTTP routes

Server-only route handlers (the app's backend). Each `route.ts` exports `POST`.
They orchestrate `lib/ai` + `lib/data` + `lib/ranker` and **degrade gracefully**:
if an AI key is missing or a call fails, they fall back to deterministic logic so
the app always answers.

| Route | Role | Falls back to |
|-------|------|---------------|
| `scan/route.ts` | **POST `/api/scan`** — menu photo → dish names. Runs `readMenuFromEnv` (Groq vision → Gemini/OpenRouter fallback → `parseDishList`). | error if no provider key |
| `rank/route.ts` | **POST `/api/rank`** — dish names + mood → ranked verdict (Architecture B). Normalizes the untrusted dish list, then `aiRankFromEnv`. | deterministic `lib/ranker` |
| `ask/route.ts` | **POST `/api/ask`** — a question + the ranked menu → a short grounded answer (LLM-in-context, Phase 2). | local `askYoBite` |

**Inputs are untrusted** — routes validate/normalize bodies (`normalizeDishes`,
shape checks) before use. See [`../../lib/ai/README.md`](../../lib/ai/README.md)
for the orchestration details.
