# `lib/data/` — owned food data + grounding (🟦 backend)

The data we **own** that anchors the AI so "which dish is better" is decided by
research, not the model's mood. Grounding here is **compositional lexical
retrieval, deliberately NOT a RAG / embeddings pipeline** — the data is structured
and small, so decomposing a dish name and composing facts beats vector search
(free, offline, instant, traceable). See
`docs/superpowers/specs/2026-06-19-grounding-without-rag-design.md`.

| File | Role |
|------|------|
| `foodReference.ts` | The research-grounded reference table: common Indian-menu dishes/ingredients with coarse macro levels + cited notes (USDA / IFCT / GI tables). `lookupFood()` = longest whole-phrase match. |
| `grounding.ts` | `groundDish(name)` — decomposes a dish name and composes cited facts from every recognized component (all matching `foodReference` rows + a synonym map + method/carb fallbacks). Unlisted dishes (e.g. "Schezwan Chilli Garlic Noodles") still ground; nonsense grounds to nothing (no fabrication). Consumed by `rankMenu` and `askMenu`. |

> Future trigger to add embeddings: transliteration / regional-spelling drift that
> the synonym map can't cover — and only behind the same `groundDish` interface.
