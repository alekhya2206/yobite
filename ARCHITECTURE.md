# YoBite — Architecture

YoBite is a **Next.js 15 App Router PWA** (React 19 + TypeScript). App Router is
full-stack: server code (route handlers) and client code (pages/components) live
side by side in `app/`, so we **document** the backend/frontend split rather than
splitting it into physical top-level folders (which would break routing and risk
bundling server-only code into the client).

The product is a **ranker, not a calorie calculator**: scan a local menu, pick a
goal/mood, get one confident "order this" with honest reasons.

## The three layers

### 🟦 Backend (server-only — runs in route handlers, may hold API keys)
- **`app/api/*`** — the HTTP surface (`/api/scan`, `/api/rank`, `/api/ask`).
- **`lib/ai/*`** — LLM providers + AI orchestration (Groq/Gemini/OpenRouter,
  menu reading, AI ranking, Q&A, the deterministic guardrail). **Never import
  these from a client component** — they assume server env (`process.env` keys).
- **`lib/data/*`** — the owned, research-grounded food reference + compositional
  grounding that anchors the AI.

### 🟩 Frontend (client — runs in the browser)
- **`app/*/page.tsx` + `*.module.css`** — the screens.
- **`components/*`** — shared UI (bottom nav, icons).
- **`lib/voice.ts`, `lib/useVoiceInput.ts`** — Web Speech mic wiring.
- **`lib/scan/postScan.ts`** — client → `/api/scan` helper.
- **`lib/storage/*`** — SSR-safe `localStorage` (the client source of truth).
- **`lib/preferences/goalToMood.ts`, `lib/meal/planFullMeal.ts`** — client-side
  shaping used by the intent/order screens.

### ⬜ Shared core (pure, deterministic, no network, no secrets)
- **`lib/ranker/*`** — the rule-based ranking brain. Runs **server-side** as the
  AI's fallback (via `lib/ai/aiRank`) and its **types** are used everywhere.
- **`lib/ai/normalizeDishes.ts`, `lib/ai/parseDishList.ts`, `lib/ai/intent.ts`** —
  pure helpers (no keys); safe on either side.

## Request flow (the core loop)

```
[Scan screen]  app/scan/page.tsx
   │  photo → downscale → postScan()
   ▼
POST /api/scan ─ readMenu (Groq vision → Gemini/OpenRouter fallback)
   │            → parseDishList → normalizeDishes  ⇒ dish names
   ▼  (stored via lib/storage)
[Intent screen] app/intent/page.tsx  ─ goalToMood() ⇒ mood text
   ▼
POST /api/rank ─ aiRank (Architecture B):
   │   rankMenu (Groq) grounded by lib/data/grounding
   │   → rankGuardrail validates → deterministic lib/ranker is the safety net
   ▼
[Order screen] app/order/page.tsx  ─ renders the verdict; planFullMeal()
   │
   └─ "Ask" → POST /api/ask ─ askMenu (LLM-in-context) → askYoBite() fallback
```

**Architecture B** = the AI ranks, a strict deterministic guardrail
(`lib/ai/rankGuardrail`) can veto it, and the rule-based `lib/ranker` is the
always-valid fallback. Grounding is **compositional, not RAG** — see
`lib/data/README.md`.

## Folder map

| Folder | Layer | README |
|--------|-------|--------|
| `app/` | frontend screens + (`app/api`) backend | [app/README.md](app/README.md) |
| `app/api/` | backend (HTTP routes) | [app/api/README.md](app/api/README.md) |
| `components/` | frontend UI | [components/README.md](components/README.md) |
| `lib/` | logic (index of all domains) | [lib/README.md](lib/README.md) |
| `lib/ai/` | backend AI | [lib/ai/README.md](lib/ai/README.md) |
| `lib/data/` | backend grounding data | [lib/data/README.md](lib/data/README.md) |
| `lib/ranker/` | shared core | [lib/ranker/README.md](lib/ranker/README.md) |
| `lib/meal/`, `lib/preferences/`, `lib/scan/`, `lib/storage/` | frontend/shared | see [lib/README.md](lib/README.md) |

## Conventions
- Tests are co-located (`*.test.ts[x]`, vitest). `npm test` · `npm run dev` ·
  `npm run build`.
- Design decisions are bound to **`DESIGN.md`** — read it before any UI change.
- Path alias `@/*` → repo root (`tsconfig.json`).
