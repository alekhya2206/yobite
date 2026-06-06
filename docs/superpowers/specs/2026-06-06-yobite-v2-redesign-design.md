# YoBite v2 — Redesign Design Spec

**Date:** 2026-06-06
**Status:** Design approved (visual + UX). Architecture + auth/onboarding deferred to next phase.
**Supersedes:** the v1 baseline look (cream-editorial) documented in the current `DESIGN.md`.

---

## 1. Why this redesign

The v1 build was mechanically complete (Next.js PWA + offline heuristic ranker, 3 screens)
but the user's verdict was "wrong vibe entirely" and "the scan screen feels very off." This
spec is a substantial redesign of the **look**, the **input experience**, the **app
structure**, and a **pivot from offline to an online, AI-powered product**.

**North star is unchanged:** *"The menu should not flesh in my mind."* Fast, calm, decisive —
a ranker, not a calorie calculator; built for the local restaurant where the diner is
actually confused. The redesign evolves *how* we deliver that, not the soul.

---

## 2. Look & feel (LOCKED)

- **Aesthetic:** "Vivid" — bold color blocks, big type, expressive. (Replaces v1 calm
  minimalism.)
- **Palette "Sunset Coral":** coral hero `#E0492F`, gold CTA `#F5A623`, peach canvas
  `#FFF1E6`, warm dark ink `#2A1207`, soft fills `#FAD8C2`/`#FFD98A`. Tier colors retained
  from product logic: recommended = coral; heavier = terracotta `#BE5E3D` (informs, never
  scolds — never stop-sign red); good-attribute green `#2F7A57`.
- **Type:** **Bricolage Grotesque** (display + brand) + **DM Sans** (body/UI). Drops Fraunces.
- **Icons:** polished line icons (Lucide-style), no emoji in chrome. Scan action uses a
  **scan-reticle** mark (corner brackets + sweep line), never a camera glyph.
- `DESIGN.md` must be rewritten to this system in the design-finalization phase.

---

## 3. Information architecture & navigation

**Bottom deck (persistent):** `Home · Browse | [Scan FAB] | Saved · Profile`
- **Scan** = center raised circular FAB (scan reticle). The hero action. Universal: works for
  any restaurant.
- **Home / Browse / Saved / Profile** = four tabs (Home always one tap → solves back-to-home).
- Drill-in screens (Restaurant detail, Verdict) use a top back arrow; tabs are for top-level
  switching.

**Two entry paths to a verdict:**
1. **Scan path** (any restaurant): Home → Camera/Voice → Per-meal intent → Verdict ⇄ Chatbot
2. **Browse path** (restaurants we already have): Home → Browse list → Restaurant detail →
   Per-meal intent → Verdict (NO scan)

---

## 4. Screens

### 4.1 Home — two states
- **Idle:** greeting · **goal card** (coral, the universal goal) · **last-visit card** ·
  "restaurants we know near you" teaser · deck.
- **Active session:** an **active dining card placed directly below the goal card** —
  "You're at Chili's · Dining now · no need to re-scan" with **"Back to your picks →"** and an
  **"End ✕"** control. See §5.

### 4.2 Scan — branded in-app camera (NOT the OS camera)
- YoBite chrome: wordmark, **Video/Photo** segmented toggle, a **framed viewport** with a
  coral guide ("fit each page inside the frame · pan slowly"), and a control panel:
  **🎤 voice · ⬤ record · 🗂️ pages** (badge = pages captured).
- **Video** is primary (pan across all pages, AI reads frames). **Multi-photo** is the
  fallback (snap page after page → analyze). Menus are 4–5 pages; one-shot upload is too much
  friction.
- **Accuracy is the app's responsibility, not the user's.** No mandatory review step for
  photo/video — the vision model must be good enough that it "just works." (v1's tesseract
  OCR failed badly — returned Hebrew gibberish on a clear Chili's screenshot. Replaced.)

### 4.3 Voice — one screen (the 🎤 path)
- For the no-printed-menu case (waiter recites). **Tap-to-lock hands-free** listening (only
  mode; push-to-talk was dropped as cluttered). Dishes transcribe to chips live; **tap any
  chip to fix inline** (voice genuinely mishears — correction stays, but on the same screen).

### 4.4 Per-meal intent (after input, before verdict)
- The AI checks in: **"What are you in the mood for — this meal?"**
- **Free-text + voice input** interpreted by an LLM (NOT canned chips). Optional shortcuts
  listed below the box (never the only option).
- **"Eaten anything earlier today?"** — also a specific free-text/voice field (presets like
  "light so far" are not specific enough).
- **Skip → uses the universal/profile goal.** Key principle: the profile goal is not a law
  for every meal; goal is per-meal, defaulting to universal.

### 4.5 Verdict — the poster
- One **"Order this"** hero (coral) with honest reason chips · **"Also good"** · **"Heavier —
  go easy"** (terracotta). Glanceable in ~2s.
- **No bottom CTAs** (no "Suggest another," no "Ask YoBite" line). It is a *suggestion*, never
  an order.
- A **floating circular chatbot FAB** (corner) for all menu conversation.

### 4.6 Chatbot — "Ask YoBite" (menu Q&A)
- Bottom-sheet chat for follow-ups the poster can't hold: full-course planning ("starter,
  main & dessert?"), swaps, "what's veg?", "something lighter?". Grounded in the scanned menu.

### 4.7 Browse — restaurant database (Swiggy/Zomato-familiar)
- Vertical scroll of restaurant **cards**: **photo → thin divider → name + rating + cuisine +
  "Tap to rank — no scan needed."** Location header, search, filter chips (All/Indian/
  Healthy/Fast food). Familiarity builds trust (same logic as UPI payment screens).

### 4.8 Restaurant detail (Browse → rank without scanning)
- Hero photo, name, rating/cuisine, **"✓ We have this menu · N dishes,"** a menu preview, and
  **"Pick for me →"** (→ per-meal intent → verdict). Escape hatch: **"Menu looks different?
  Re-scan it."**

### 4.9 Profile
- Avatar + name, **goal** (editable), **dietary restrictions** (chips, editable), light
  history stats (menus decoded, saved places). **No body weight** (avoids the gym-app wizard;
  may revisit later behind a waitlist).

### 4.10 Saved
- The user's favorited (🤍) restaurants as a quick list; one tap back into ranking.

---

## 5. Active dining session (new core concept)

- Scanning (or opening) a restaurant starts an **active session** that **persists across app
  close/reopen** and surfaces on Home (below the goal card).
- While active: **no re-scanning** — tapping the card returns to the picks + chatbot.
- **"End ✕"** closes the session. YoBite is session-based, not one-shot.

---

## 6. Architecture pivot (high-level — details to /plan-eng-review)

This redesign **reverses v1's "pure offline heuristic, no LLM/API"** decision:
- **Online backend** with user identity, profiles, saved restaurants, history, and
  **active-session state synced** across devices.
- **Vision-AI menu reader** replacing tesseract: photo (very achievable with a modern vision
  LLM) and **video** (sample frames while panning → read each → stitch/de-dupe pages — the
  single hardest accuracy target).
- **LLM intent parser** for the free-text/voice per-meal goal + "ate earlier" inputs.
- **Menu chatbot** grounded in the scanned/known menu.
- **Restaurant-menu database** powering Browse/Saved (a build + maintenance commitment, and a
  potential moat).
- **Grounded nutrition reasoning:** recommendations must be defensible, not "AI out of the
  blue." Ground estimates in credible **ingredient/cooking-method** reference data (not
  per-dish papers — the wedge is still local dishes that aren't published anywhere).

These are design intentions; the actual system design (model choice, DB schema, pipelines,
cost) is the job of `/plan-eng-review`.

### 6a. Architecture — LOCKED via /plan-eng-review (2026-06-06)

**Scope = C (focused v1 + accounts/DB).** Ship the core app + managed auth + DB. DEFER the
curated Browse library, video scan, advanced sync. (Saved still ships = user's own scanned
places.)

**Budget = ₹0 / free APIs only** until validated. Free ≠ low quality.

**Backend = Supabase** (Postgres + Auth + Storage + Edge Functions). Serves the PWA now and
native iOS/Android later identically (same backend, only the frontend changes). Postgres fits
profiles/sessions/history + full-text search; supports Google/phone-OTP/Apple sign-in.

**AI layer = Gemini Flash (free) PRIMARY + OpenRouter Qwen2.5-VL FALLBACK**, behind a swappable
provider abstraction (`readMenu`, `parseIntent`, `chat`), all server-side (keys never in the
browser). Groq optional for fast chat. Gemini free ≈ 1,500 req/day; abstraction makes a paid
swap a one-line change.

**Engine = HYBRID:** LLM only reads the menu image → dish list, grounds nutrition gaps, writes
"why" reasons, and powers the chatbot. The deterministic `lib/ranker` + `knowledge.ts` does
the scoring (fast, free, testable, explainable; keeps API/rate-limit pressure low). Keep the
`rank()`/`RankResult` contract.

**Data model (Postgres):** `profiles` (goal, dietary), `restaurants` (per-user library: name,
note, cached `menu_dishes` JSONB, `verified` flag, last_visited — populated by the user's own
visits, ZERO sourcing cost), `sessions` (one active per user via partial unique index; points
at a `restaurant`; caches per-meal goal + `verdict`; status active|ended). Raw menu images NOT
persisted (extract → discard). Ranking runs server-side. **Revisiting a saved place loads its
cached menu → skips scanning entirely.**

**Failure handling:** scan → loading + 20s timeout + retry + Qwen-VL fallback + graceful
"type/say it" if all fail (never silent); low-confidence read → lightweight confirm only when
unsure; rate-limit → overflow to OpenRouter + cache + "high demand" message; chat/reasons LLM
down → degrade, don't block the verdict.

### 6b. Tests
Keep + extend the 28 `lib/ranker` tests. Mock LLM providers (test failover, scan parsing,
intent→universal fallback). E2E: scan→intent→verdict, failover, session persistence, End.
[→EVAL] vision accuracy: real menu photos with expected dish lists scored vs Gemini.

### 6c. Reuse / delete
Reuse: `lib/ranker` (contract stable), `knowledge.ts` (grounding ref), `lib/voice.ts`,
`lib/store.ts` (→ session). Restyle all screens. Delete: `lib/ocr.ts` (broken tesseract).

---

## 7. Scope & open decisions (for /plan-ceo-review)

- **In scope (this design):** the full core app — Home (+active session), Scan (video/photo),
  Voice, Per-meal intent, Verdict, Chatbot, Browse, Restaurant detail, Profile, Saved.
- **Deferred to a follow-up spec (explicitly out of scope here):** first-run **onboarding**
  (splash/"preparing" + a few light questions) and **authentication** (Google / phone-OTP /
  Apple / email; and whether to require sign-in up front vs. "try first, sign in to save").
  The user has parked these as the final layer.
### 7a. CEO review decisions — LOCKED (2026-06-06)

Mode: **SCOPE REDUCTION** — cut to the sharpest test of the core premise: *will a real diner
at a real local restaurant trust the pick enough to order it?* v1's job is to answer that with
the least built.

**v1 launch =** name the place → scan a local menu (or load it if visited before) → "what are
you in the mood for?" (free-text/voice) → **verdict** (single best pick) → optional **"Plan a
full meal"** (best starter / main / dessert) → end session → **place + menu saved to My Places**.
Accounts + Sunset Coral throughout.

LOCKED decisions:
- **Browse REFRAMED, not cut:** Browse = **"My Places"** — the user's OWN visited local
  restaurants, menu auto-cached on session end. Revisit → no re-scan. Zero sourcing cost
  (user-generated). Ask the **place name at scan start**. Filters: **Visited** (user's own) +
  **Verified** (our badge — filter ships, curated data deferred/light). Serves the local-place
  wedge directly.
- **"Plan a full meal" IN v1** — deterministic, reuses `lib/ranker` + `knowledge.ts` (group by
  course, rank each). NOT an LLM chatbot. Secondary action off the verdict, never the auto
  screen. Nails the multi-course "dinner with family" use case cheaply, low trust risk.
- **Open-ended menu chat → v1.1 (deferred).** The free-text "ask anything about the menu" LLM
  feature is the only true chatbot; open-ended + trust-risky → ship after the core loop is
  trusted. Line: bounded/deterministic → v1; open-ended/LLM → v1.1.
- **Presence thesis HELD.** No notifications, feeds, gamification, or discovery browsing.
- **Body weight:** deferred (revisit post-validation).

---

## 8. Mockups (reference)

In `.superpowers/brainstorm/7428-1780696706/content/`:
`full-app.html` (the complete board), `final-three-screens.html`, `session-and-chat.html`,
`camera-template.html`, `browse-swiggy.html`, `nav-home.html`, `home-v2.html`,
`vivid-palettes.html`, `typography.html`.

---

## 9. What stays from v1

- The product thesis, the north star, the tier semantics (green recommend / terracotta
  heavier, never red), and the `rank()` → best/also-good/heavier output shape (the *ranking
  contract*), even though the engine behind it moves from offline heuristic toward grounded
  AI. Keep the result-shape stable so screens don't churn.

---

## 10. Implementation Tasks (synthesized from eng-review)

- [ ] **T1 (P1)** — Backend — Stand up Supabase project; schema: `profiles`, `sessions`
  (partial unique active index), `chat_messages`, `saved_restaurants`. Verify: migrations apply,
  RLS policies scope rows to the auth user.
- [ ] **T2 (P1)** — AI abstraction — `lib/ai/` provider interface (`readMenu`, `parseIntent`,
  `chat`) with Gemini primary + OpenRouter fallback; server-only. Verify: unit tests mock both,
  failover path covered.
- [ ] **T3 (P1)** — Scan — `/api/scan`: image → dish[] via `readMenu`; client image downscale;
  20s timeout + retry + fallback; low-confidence → confirm. Delete `lib/ocr.ts`. Verify: E2E +
  failover test.
- [ ] **T4 (P1)** — Ranking — `/api/rank`: `lib/ranker(dishes, goal)` + LLM reasons; cache verdict
  on session. Keep `rank()` contract. Verify: extend the 28 ranker tests; reasons-LLM-down degrades.
- [ ] **T5 (P1)** — Per-meal intent — `/api/parseIntent` free-text/voice → goal; skip → universal.
  Verify: fallback-to-universal test.
- [ ] **T6 (P1)** — Active session — create on scan, one-active enforcement, Home active card,
  re-open w/o re-scan, End. Verify: persistence E2E (close/reopen), race conflict.
- [ ] **T7 (P2)** — Chatbot — `/api/chat` grounded in `session.menu_dishes`; bottom-sheet UI;
  non-blocking. Verify: chat-down degrades gracefully.
- [ ] **T8 (P2)** — Auth + onboarding — Supabase Auth (Google/phone-OTP), "try first, sign in to
  save", light onboarding (goal + dietary, no body weight). *(The "cherry" phase per the user.)*
- [ ] **T9 (P1)** — Design system — restyle all screens to Vivid/Sunset Coral/Bricolage; rewrite
  `DESIGN.md`. Verify: `/design-review`.
- [ ] **T10 (P2)** — Vision eval — small labeled menu-photo set scored vs Gemini; run on prompt/model
  change. Verify: eval harness produces an accuracy number.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SCOPE REDUCTION; Browse reframed to user-generated "My Places"; full-meal planner in v1; open-ended chat → v1.1; presence thesis held |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | scope reduced to C; backend/AI/engine/data-model locked; low-confidence-read gap resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | design done in brainstorm; formal review pending (recommended next) |

- **UNRESOLVED:** none. v1 scope locked (see §7a).
- **VERDICT:** CEO + ENG CLEARED — scope and architecture locked. Recommended next: the design
  loop (`/design-consultation` → rewrite DESIGN.md → `/design-review`), then build.
