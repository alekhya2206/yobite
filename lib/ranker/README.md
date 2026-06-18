# `lib/ranker/` — the deterministic ranking brain (⬜ shared core)

Pure, deterministic, **no LLM / no network / no API key**. This is the honest
heuristic engine: it reads a dish *name* (local restaurants publish no nutrition
data) and ranks for a goal. It runs **server-side as the AI's fallback** (via
`lib/ai/aiRank`) and its **types are the shared contract** used across the app.

Pipeline: `parse` → `classify` → `score` → bucket → `reasons`.

| File | Role |
|------|------|
| `index.ts` | Public entrypoint — exports `rank()`, `askYoBite`, `detectKnownChain`, types. |
| `parse.ts` | Raw pasted/OCR'd menu text → clean dish-name candidates (strips prices/headers; protects "Chicken 65"). |
| `classify.ts` | A cleaned name → coarse, honest `DishProfile` + `kind`, using `knowledge.ts`. |
| `knowledge.ts` | The token tables: lean/fried methods, proteins (with grams), refined/light carbs, veg/dessert/drink signals. India-first. |
| `score.ts` | `DishProfile` → 0–100 goal-relative score (per-goal weight vectors). |
| `context.ts` | Parses the optional "eaten today?" field into balancing signals ("you've already had rice today"). |
| `reasons.ts` | Reason generation — "reasons over numbers": honest chips + one-line whys. |
| `ask.ts` | `askYoBite` — instant local Q&A over the ranked dishes (no model call); the fallback for `/api/ask`. |
| `types.ts` | Type contracts: `Goal`, `Dish`, `DishProfile`, `RankedDish`, `RankResult`, etc. |
