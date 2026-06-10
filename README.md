<div align="center">

<img src="public/logo.png" alt="YoBite" width="220" />

# YoBite

**Scan a restaurant's menu, tell it your mood, get one confident "order this" — with a reason.**
A *ranker*, not a calorie calculator.

> **North star:** *"The menu should not flesh in my mind."*
> Fast, calm, decisive — get one good answer and get back to the table.
> Built for the **local restaurant** where the diner is actually confused, not the chain they already know.

</div>

---

## The whole app at a glance

![All screens](docs/design/01-all-screens.png)

---

## What it is

A mobile-first PWA (native iOS/Android planned). You point it at any menu — **photograph it,
or say it out loud** — tell it what you're in the mood for *this meal* ("high protein", "high
carb but the better kind", "something light", "veg only"), and it hands back a **poster
verdict**: one best pick, a few "also good," and gently flagged "heavier" choices, each with an
honest *why*. No order is ever placed; it's a suggestion that gets you decided in seconds.

Built for **presence, not engagement** — no streaks, no feed, no daily-login loops. The best
session is the shortest one.

---

## What makes the ranking *correct* (the interesting part)

YoBite doesn't just match a macro — it judges **quality**. Ask for "high carb" and it won't
hand you instant noodles; it knows a whole-food carb beats a refined one. Real output:

```
You: "I'm in the mood for high carbs"
Menu: Chow Mein · Fried Rice · Maggi · Mashed Potatoes · White Rice

Order this →  Mashed Potatoes   "Whole potato — complex carbs + fibre, lower GI than refined noodles"
Also good     White Rice        "Single refined grain, but not ultra-processed"
              Fried Rice        "Refined rice + oil — a better carb than refined-flour noodles"
Heavier       Chow Mein         "Refined-flour noodles, oil-fried, low in fibre"
              Maggi             "Ultra-processed instant noodles — negligible fibre/micronutrients"
```

Same logic across every axis — protein (grilled beats fried), fibre (lentils beat white rice),
calories, sweetness, and a hard **veg-only** filter. Identical input → identical output, every time.

---

## Design

YoBite is **"Vivid"** — bold color blocks, big type, expressive — in the **Sunset Coral**
palette with **Bricolage Grotesque + DM Sans**. Full system in [`DESIGN.md`](DESIGN.md).

| Home · Scan · Verdict | Per-meal intent · Chatbot · Active session |
|---|---|
| ![Home, scan, verdict](docs/design/02-home-scan-verdict.png) | ![Intent, chat, session](docs/design/03-intent-chat-session.png) |

| Browse (your saved restaurants) | Palette exploration |
|---|---|
| ![Browse](docs/design/04-browse.png) | ![Palettes](docs/design/05-palette-options.png) |

**Design system in one line:** coral `#E0492F` · gold `#F5A623` · peach canvas `#FFF1E6` ·
warm ink `#2A1207` · terracotta `#BE5E3D` for "heavier" (informs, never scolds — never
stop-sign red). Light-mode only, to match the approved mockups.

---

## How it works

### The flow
```
Home ──(Scan)──> Camera / Voice ──> "What are you in the mood for?" ──> Verdict
Home ──(Browse)─> a restaurant you've saved ──────────────────────────> Verdict   (no re-scan)
```
Scanning a place starts an **active dining session** that lives on your home screen and
persists across closing the app — reopen and you're back at your picks instantly, until you
tap **End**.

### The ranking brain — "AI ranks, a guardrail enforces correctness"

```
mood text  +  menu dishes
     │
     ▼
🤖 AI ranks (Groq, free)        — orders the dishes for your mood and writes grounded reasons,
   grounded by our food data       fed our research reference as AUTHORITATIVE facts
     │   returns ordered tiers + a low/med/high read of carbs/protein/calories/quality per dish
     ▼
🛡️ Strict guardrail (deterministic, instant, fully tested) rejects:
     • invented dishes / dropped dishes
     • an ultra-processed or low-quality best pick when a better option exists
     • a best pick that contradicts the mood (e.g. low-carb dish for a high-carb request)
     • non-veg dishes when the mood is "veg only"
   → one corrective retry → deterministic fallback ranker
     ▼
🏆 Verdict  (best · also good · heavier, each with a reason)
```

The separation is the point: **the AI only proposes; the guardrail disposes.** The AI can't
hallucinate a dish or hand you a pick that contradicts what you asked — so the answer is both
intelligent *and* trustworthy.

Key modules in `lib/`:
- **`ai/rankMenu.ts`** — the Groq ranking call + the structured-output parser.
- **`ai/rankGuardrail.ts`** — the deterministic validator + the adapter to the stable `RankResult`.
- **`ai/aiRank.ts`** — orchestration: AI → guardrail → retry → fallback.
- **`data/foodReference.ts`** — the **research-grounded reference** (common dishes × carbs/protein/
  fat/fibre/calories/quality/glycemic + a cited "why", seeded from USDA / IFCT / GI principles).
  Injected into the prompt and treated as authoritative by the guardrail.
- **`ranker/`** — the original deterministic engine (parse → classify → score → reasons), now the
  free, offline **fallback** floor when the AI is unavailable.

---

## Architecture

```
        [ PWA — Next.js 15 / React 19 ]      (native iOS/Android later, same backend)
   Home · Scan · Intent · Verdict · Browse · Saved · Profile
                     │ HTTPS
                     ▼
     [ Serverless API routes ]  ← hold all AI keys (never in the browser)
        /api/scan  → vision LLM: menu image → dish[]
        /api/rank  → AI ranking + strict guardrail + grounded food reference
            │                                   │
            ▼                                   ▼
   [ local-first storage ]              [ AI providers ]
     profile/goal, active session,        Groq (free tier) — PRIMARY (vision + ranking)
     My Places (localStorage now;         Gemini Flash — optional fallback
     Supabase auth + Postgres later)      OpenRouter / Qwen-VL — optional fallback
```

- **Free-tier by design** — Groq's free tier runs the vision scan + the ranking; the
  deterministic ranker needs no API at all. Providers sit behind a swappable abstraction.
- **Local-first** — profile, the active session, and My Places live in `localStorage`;
  Supabase (auth + cross-device sync) is a later swap behind the same interface.

---

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · CSS Modules · Vitest · PWA (`app/manifest.ts`).
AI: Groq (free tier) for vision + ranking, with Gemini/OpenRouter fallbacks. Storage: localStorage
now, Supabase planned.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  (mobile-first)
npm run dev:https    # https on your LAN, so the phone camera works (getUserMedia needs a secure origin)
npm test             # full test suite (vitest) — 140+ tests, providers mocked, no keys needed
npm run build        # production build
```

### AI key (free)

Scan + rank call a free-tier model. Copy `.env.example` to `.env.local` and add a key:

- `GROQ_API_KEY` — **primary** (vision + ranking), free tier, very fast. https://console.groq.com/keys
- `GEMINI_API_KEY` — optional fallback. https://aistudio.google.com/apikey
- `OPENROUTER_API_KEY` — optional fallback. https://openrouter.ai/keys

Unit tests mock the providers and need no keys.

## Project structure

```
app/         Next.js routes (home, scan, intent, order/verdict, browse, saved, profile) + API routes
lib/ai/      AI providers (Groq/Gemini/OpenRouter), AI ranking, guardrail, scan pipeline
lib/data/    foodReference — the research-grounded nutrition reference
lib/ranker/  the deterministic fallback ranker (+ tests)
lib/storage/ local-first storage (profile, session, My Places)
components/   shared UI (Logo, icons, Deck …)
docs/        design spec + design screenshots + known-issues log
DESIGN.md    the visual source of truth
```

## Status & roadmap

- ✅ **v2 UI** built — Home, Scan (in-app camera), Intent, Verdict, deck nav (local-first).
- ✅ **AI ranking (Architecture B)** — Groq ranks, a strict guardrail enforces correctness;
  grounded by a research food reference. Quality-aware across carbs/protein/fibre/calories/veg.
- ✅ **Grounded data v1** — a curated nutrition reference, injected + authoritative.
- ⏭️ **Next:** scale the food reference (free batch via local Ollama / Groq + public datasets);
  Supabase auth + sync; the menu chatbot; video scanning; native apps.

---

<div align="center">
<sub>Built with care. A decider, not a tracker.</sub>
</div>
