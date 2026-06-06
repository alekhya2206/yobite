# Design System — YoBite (v2)

> **North star:** *"The menu should not flesh in my mind."* Fast, calm-but-confident,
> decisive. Scan, get one bold answer, order, and you're back at the table.
>
> **The memorable thing:** the **coral "Order this" verdict** that decides for you in two
> seconds. Everything serves that moment.
>
> This v2 system **supersedes** the original "warm appetizing minimalism" (cream + Fraunces)
> direction. See the Decisions Log and
> `docs/superpowers/specs/2026-06-06-yobite-v2-redesign-design.md`. Design screenshots live
> in `docs/design/`.

## Product Context
- **What this is:** A mobile-first PWA (native iOS/Android planned). Scan a local restaurant's
  menu, say what you're in the mood for, get a ranked "order this" with honest reasons. A
  *ranker*, not a calorie calculator.
- **Who it's for:** Fitness/nutrition-conscious diners first; approachable for anyone. Strong
  India-market relevance (carb-heavy diets, protein interest, local/unlisted restaurants).
- **Space/industry:** Nutrition / food / health — positioned *against* the category (warm,
  bold, decisive), not the clinical-tracker norm.
- **Project type:** Consumer mobile-first web app (PWA), tab-bar app shell + camera + poster
  result.

## Aesthetic Direction
- **Direction:** **Vivid** — bold color blocks, big expressive type, confident and
  appetizing. (Replaces v1 calm minimalism, which the builder felt was "wrong vibe entirely.")
- **Decoration level:** intentional-to-expressive — saturated color blocks and big type do the
  work; no patterns, no clutter, no gradients-as-decoration.
- **Mood:** a decisive friend who knows food. Energetic, warm, reassuring. The opposite of a
  spreadsheet, a doctor's chart, or a gym app — and louder/bolder than a quiet menu.
- **Reference feel:** the expressive end of food apps (Swiggy/Zomato familiarity for Browse),
  but with a single confident verdict instead of an endless feed.

## Typography
- **Display / Hero / Brand:** **Bricolage Grotesque** (characterful modern grotesk, opsz
  variable) — the face of YoBite. Used for the wordmark, the "Order this" dish name, section
  titles, greetings. *Rationale:* distinctive and contemporary without being generic; carries
  the bold/expressive personality.
- **Body / UI / reasons:** **DM Sans** — warm geometric sans, razor-legible at small sizes,
  pairs cleanly under Bricolage.
- **Data / macro chips:** **DM Sans with `font-variant-numeric: tabular-nums`** — protein
  grams and counts stay aligned and calm; macros are a quiet bonus, never the headline.
- **Loading:** Google Fonts —
  `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600;700&display=swap`
  (Bunny Fonts is an acceptable privacy-friendly mirror.) Use `next/font` in the app.
- **Scale (rem, 16px base):** display-xl 2.4rem / display 1.9rem / h1 1.55rem / h2 1.25rem /
  body 1rem / small 0.8rem / chip 0.72rem. Display weight 800, letter-spacing -0.01 to -0.02em.
- **Never use:** Fraunces (v1, retired), Inter, Roboto, Space Grotesk, or system-ui for
  display/body.

## Color
- **Approach:** expressive but disciplined — coral carries identity and the "best pick," gold
  carries action, tier colors stay warm and honest.
- **Canvas / Paper:** `#FFF1E6` — warm peach. Appetizing, never clinical white.
- **Surface / Cards:** `#FFFFFF` (and `#FFF6EC` for tinted surfaces) — lifts off the peach.
- **Ink / Primary text:** `#2A1207` — warm near-black, confident (not harsh pure black).
- **Muted text:** `#7A5230` — warm brown, for secondary body text. Passes WCAG AA (~4.6:1) on
  the peach canvas. (`#9A7B63` is lighter — large/decorative text only, fails AA at body size.)
- **Brand + "Order this" / best pick:** `#E0492F` — confident coral. The hero block + wordmark.
- **Primary action / CTA:** `#F5A623` — warm gold. Buttons, "Find my pick," "Plan a full meal."
  CTA ink on gold = `#3A2400`.
- **Positive / healthy signal:** `#2F7A57` — deep herb green. "Menu ready" badges, "also good"
  checks, good-attribute chips. (Green is now a *signal*, not the primary brand color.)
- **Heavier tier:** `#BE5E3D` — muted terracotta. **Deliberately NOT stop-sign red** — it
  informs, it doesn't scold. Serves "not a guilt trip."
- **Hairlines / borders:** `#F0E2D2`.
- **Soft tier fills (chips/pills):** coral-soft `#FAD8C2`, gold-soft `#FFD98A`, green-soft
  `#E7F0EA`, terracotta-soft `#F3E2DA`.
- **Dark mode (warm, not gym-black):** paper `#1A130C`, surface `#241A11`, ink `#FBEFE2`,
  muted `#C4A98C`, hair `#352819`; lift accents for contrast — coral `#FF7A55`, gold `#FFC04D`,
  green `#5FB587`, terracotta `#D8825F`. Keep saturation calm; reduce ~10–15%.

## Spacing
- **Base unit:** 8px (4px substeps allowed).
- **Density:** comfortable; spacious on the verdict (the order card breathes); tighter in
  Browse cards and chips.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** mobile-first single column with a persistent bottom **deck** (tab bar).
- **Navigation deck:** `Home · Browse | [Scan] | Saved · Profile` — a raised circular **Scan**
  FAB in the center (the hero action); Home/Browse/Saved/Profile as line-icon tabs. Drill-in
  screens (restaurant detail, verdict) use a top back arrow.
- **The result is a poster:** one big confident "Order this" pick up top (coral block),
  reasons as chips, "also good" below, "heavier — go easy" muted (terracotta) at the bottom.
  Glanceable in ~2 seconds. No bottom CTAs on the verdict; a corner action opens "Plan a full
  meal."
- **Grid:** single column on mobile; max content width ~1080px on web.
- **Border radius (soft, confident, not bubbly):** sm 10px, md 14px (cards), lg 18px, xl 22px
  (hero/sheets), full 999px (pills/buttons/FAB).
- **Input:** voice-forward — voice is welcomed beside the scan controls, not buried.

## Iconography
- **Style:** clean line icons (Lucide-style stroke ~2px), warm ink or coral when active. **No
  emoji in chrome.**
- **Scan icon:** a **scan reticle** — four corner brackets + a sweep line. Never a camera
  glyph (reads dull). Echoes the framing brackets in the camera template.
- **Deck icons:** house (Home), utensils (Browse), bookmark (Saved), user (Profile).

## Motion
- **Approach:** intentional. Hero moment: the **"thinking → verdict" reveal** — the answer
  arrives with a calm settle (gentle rise + fade, ~250ms). Confident, never bouncy.
- **Signature animations:** camera **scan-line sweep**, voice **listening ripples**, the Scan
  **FAB pulse**. Everything else is quiet.
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 50–100ms · short 150–250ms · medium 250–400ms · long 400–700ms.

## Key components (visual contracts)
- **Bottom deck + center Scan FAB** — coral FAB with the scan-reticle, white deck, line icons.
- **Branded camera template** — YoBite chrome around the live feed (NOT the OS camera):
  wordmark, Video/Photo toggle, framed viewport with a coral guide, control panel (voice ·
  record · pages).
- **Verdict poster** — coral "Order this" hero (dish in Bricolage + reason chips), white
  "also good" rows with green checks, terracotta "heavier — go easy" card.
- **My Places cards (Browse)** — Swiggy/Zomato-familiar: photo → hairline divider → name +
  rating + cuisine + "tap to rank, no scan." Filters: Visited · Verified.
- **Active session card (Home)** — green "Dining now" status, sits directly below the goal
  card, "Back to your picks" + "End ✕."

## Safe choices vs. deliberate risks
- **Safe (category literacy):** mobile-first single column + bottom tab bar; big tap targets;
  Swiggy/Zomato-familiar Browse cards (trust through familiarity); green = positive signal.
- **Risk 1 — Vivid bold color blocks** (coral hero) in a category of calm/clinical trackers.
- **Risk 2 — Bricolage Grotesque** display in a sans-default category (characterful, modern).
- **Risk 3 — terracotta "heavier," never red** — reassure, don't scold.
- **Risk 4 — anti-engagement by design:** no streaks, no feed, no notifications; the verdict
  is built to be glanced and dismissed. Sessions reduce friction, not increase dwell.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-05 | Initial design system (cream + Fraunces, "warm appetizing minimalism") | /design-consultation v1. **Superseded by v2 below.** |
| 2026-06-06 | **v2 redesign — "Vivid" / Sunset Coral / Bricolage Grotesque + DM Sans** | Builder's reaction to v1: "wrong vibe entirely." Direction chosen via brainstorming with live mockups: vibe (Vivid) → palette (Sunset Coral) → type (Bricolage). Verified visually in `docs/design/`. |
| 2026-06-06 | Scan icon = scan reticle (not camera); deck = line icons, center Scan FAB | Camera glyph read as dull; reticle echoes the camera-template brackets and reads as "smart scan." |
| 2026-06-06 | Muted text `#7A5230` on peach `#FFF1E6` | WCAG AA (~4.6:1) for body-size secondary text; lighter `#9A7B63` reserved for large/decorative. |
| 2026-06-06 | Green demoted from brand to "positive signal"; coral = brand + best pick | Vivid direction makes coral the identity; green now marks healthy/also-good, terracotta marks heavier. |
