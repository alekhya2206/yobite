# Design System — YoBite

> North star: **"The menu should not flesh in my mind."** YoBite isn't an app you
> *use*, it's an app you *pass through*. Scan, get one confident answer, order, and
> you're back to the people at the table. Every design decision serves being **fast,
> calm, and decisive** so the user's attention returns to their meal and their company.

## Product Context
- **What this is:** A mobile-web PWA. Paste/scan a restaurant's menu, pick your goal +
  what you ate today, get a ranked "order this" with reasons. A *ranker*, not a calorie
  calculator.
- **Who it's for:** Fitness/nutrition-conscious people first; approachable enough for
  any diner. Strong India-market relevance (carb-heavy diets, protein interest).
- **Space/industry:** Nutrition / food / health, but positioned against the category,
  not within it (see Aesthetic rationale).
- **Project type:** Consumer mobile-first web app + a marketing landing page.

## Aesthetic Direction
- **Direction:** Warm appetizing minimalism — calm and decisive.
- **Decoration level:** minimal-intentional (warmth does the work; no patterns, no clutter).
- **Mood:** A beautifully printed restaurant menu that happens to be smart. Premium,
  human, reassuring. The opposite of a spreadsheet, a doctor's chart, or a gym app.
- **Positioning insight (why we break from the category):** Every nutrition app
  (Lifesum, Cal AI, HealthifyMe) is built for daily *logging* — retrospective,
  engagement-maximizing, streak-driven. YoBite is a *decider*, not a tracker. The best
  session is the *shortest* one. So YoBite is designed for **presence, not engagement**:
  no streaks, no gamification, no daily-login loops. It should be proud of how fast you leave.
- **Reference poles:** lean toward Lifesum's *warmth* (cream, editorial, calm); away
  from Cal AI's gym-dark high-energy and away from clinical white/blue.

## Typography
- **Display / Hero:** **Fraunces** (warm modern serif, opsz variable) — the face of
  YoBite. Used for the landing hero, the "order this" verdict, and section titles.
  Italics for warmth. Display only — never body. *Rationale:* an editorial, appetizing
  serif in a category full of grotesks = instant differentiation + warmth.
- **Body / UI / reasons:** **DM Sans** — warm geometric sans, razor-legible at small
  sizes, pairs cleanly under Fraunces.
- **Data / macro chips:** **DM Sans with `font-variant-numeric: tabular-nums`** —
  numbers stay aligned and calm; macros are a quiet bonus, never the headline.
- **Loading:** Google Fonts —
  `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600;700&display=swap`
  (Bunny Fonts is an acceptable privacy-friendly mirror.)
- **Scale (rem, 16px base):** display-xl 4rem / display 2.75rem / h1 1.9rem /
  h2 1.3rem / body 1rem / small 0.875rem / chip 0.78rem. Display letter-spacing -0.02 to -0.025em.
- **Never use:** Inter, Roboto, Space Grotesk, or any system-ui font for display/body
  (category default = looks generic).

## Color
- **Approach:** restrained + food-warm. One green accent carries meaning; tiers are warm-toned.
- **Canvas / Paper:** `#FAF6EF` — warm cream. Reassuring, appetizing, never clinical white.
- **Surface / Cards:** `#FFFDF9` — lifts gently off the cream.
- **Ink / Primary text:** `#211C16` — warm near-black, confident (not harsh pure black).
- **Muted text:** `#756B61` — warm gray. (Darkened from `#8C8378` to pass WCAG AA 4.5:1 on the cream canvas for body-size secondary text; the lighter tone failed at ~3.46:1.)
- **Recommended / "Order this":** `#2F7A57` — deep herb green. The "go" / best-pick signal.
- **Mindful / Moderate tier:** `#D98E3D` — warm amber.
- **Heavier tier:** `#BE5E3D` — muted terracotta. **Deliberately NOT stop-sign red** —
  it informs, it doesn't scold. Serves "not a guilt trip."
- **Hairlines / borders:** `#EAE3D8`.
- **Soft tier fills (badges/pills):** green `#E7F0EA`, amber `#F7ECDC`, terracotta `#F3E2DA`.
- **Dark mode (warm, not gym-black):** paper `#181410`, surface `#221C16`, ink `#F3ECE0`,
  muted `#A89E90`, hair `#332B22`; lift accents for contrast — green `#5FB587`,
  amber `#E9A95E`, terracotta `#D8825F`. Keep saturation calm.

## Spacing
- **Base unit:** 8px.
- **Density:** comfortable, spacious on the verdict (the order card breathes); tighter where data lives.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** hybrid — mobile-first single column for the app; warm editorial for the landing page.
- **The result screen is a poster:** one big confident "Order this" pick up top, reasons
  as chips, "also good" picks below, "heavier choices" muted at the bottom. Glanceable in 2 seconds.
- **Grid:** single column on mobile; max content width ~1080px on web/landing.
- **Border radius (soft, not bubbly):** sm 8px, md 14px (cards), lg 20px, full 999px (pills/buttons).
- **Input:** voice-forward — voice input is welcomed in the UI, not buried.

## Motion
- **Approach:** minimal-intentional. One hero moment: the **"thinking → verdict" reveal**
  — the answer arrives with a calm settle (gentle rise + fade, ~250ms). Confident, never
  bouncy (bounce undercuts "decisive"). Everything else is quiet.
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 50–100ms · short 150–250ms · medium 250–400ms · long 400–700ms.

## Safe choices vs. deliberate risks
- **Safe (category literacy):** mobile-first single column + big tap targets; green =
  recommended; DM Sans for all body/UI legibility.
- **Risk 1 — Fraunces serif display** in a sans-only category (editorial, premium, menu-like). Display only.
- **Risk 2 — calm warm palette**, no alarm-red, no gym-black; "heavier" = terracotta (reassure, don't scold).
- **Risk 3 — anti-engagement by design:** no streaks, no gamification; the verdict is built to be glanced and dismissed.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-05 | Initial design system created | /design-consultation, grounded in research of Lifesum, Cal AI, HealthifyMe + the "presence not engagement" insight. Warm appetizing minimalism; Fraunces + DM Sans; calm green/amber/terracotta. Approved via HTML preview. |
| 2026-06-05 | Muted text darkened `#8C8378` → `#756B61` | /design-review of the result screen: secondary text failed WCAG AA (3.46:1 on cream). New value passes at ~4.6:1. Also bumped back + mic buttons to 44px touch targets. |

<!-- Preview artifact: /tmp/yobite-design-preview.html (hand-built, real fonts) -->
