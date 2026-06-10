# YoBite brand sources

Source logo art (user-provided) + the open logo task, kept in-repo so any session has context.

## Files
- **`app-icon-source.png`** — the full coral-card logo lockup (Y + magnifier + MENU card + check
  + "YoBite" wordmark + "SCAN. TELL MOOD. ORDER THIS." tagline). This is the **app icon** →
  generated into `public/icon-192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`,
  `favicon-*.png/.ico`, and `public/logo.png`.
- **`symbol-base-transparent.png`** — the transparent **symbol** (Y + magnifier + cream MENU card
  + gold check), background removed. Handle is **coral** in this base. This is what
  `public/logo-symbol.png` is derived from (shown in the Home + Scan headers beside the "YoBite"
  wordmark — "Yo" coral `#E0492F`, "Bite" gold `#F5A623`, Bricolage Grotesque).
- **`symbol-target-goldhandle.png`** — the **desired look**: same symbol but the magnifier
  **handle is gold**, not coral. (It has a baked-in gradient background, so it can't be cleanly
  cut out; the cream MENU card is also low-contrast against its bg.)
- **`symbol-issue-annotation.png`** — user's annotation showing the current recolor problem.

## OPEN TASK (logo not yet accurate)
`public/logo-symbol.png` was produced by recoloring the coral handle → gold via PIL hue-shift
(constrained to a handle capsule AND outside the ring circle). The user says the result is
**still not accurate** — the gold is not proportionate / bleeds, it should be **ONLY the handle**
in gold, the ring fully coral.

**Better fix options for next session:**
1. Ask the user for a **clean transparent PNG** of `symbol-target-goldhandle` (gold handle,
   transparent bg) — then no recolor is needed.
2. Or redo the recolor in `public/logo-symbol.png` more precisely (tighter handle mask). The
   handle capsule in the 678×636 base is roughly segment (508,470)→(628,598), and the magnifier
   ring center is ~(366,328) with outer radius ~201 (handle = pixels outside that circle).
3. Separately, the cream **MENU card blends** with the peach app canvas — currently softened with
   a CSS `drop-shadow` on the header `<img>` in `app/page.tsx`; may want a stronger treatment.

Verify visually with the `browse` skill: `goto http://localhost:3000`, screenshot `--selector header`.
