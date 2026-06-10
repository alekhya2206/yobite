# YoBite brand sources

Source logo art (user-provided) + the open logo task, kept in-repo so any session has context.

## Files
- **`app-icon-source.png`** — the full coral-card logo lockup (Y + magnifier + MENU card + check
  + "YoBite" wordmark + "SCAN. TELL MOOD. ORDER THIS." tagline). This is the **app icon** →
  generated into `public/icon-192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`,
  `favicon-*.png/.ico`, and `public/logo.png`. Also rendered as the rounded badge `public/logo-mark.png`
  shown in the Scan header (cream symbol on coral — a different treatment from the standalone symbol).
- **`symbol-gold-final.png`** — ✅ **the canonical symbol** (transparent bg, **gold handle**, coral
  ring, cream MENU card + gold check). User-provided clean export, 678×639. This IS
  `public/logo-symbol.png` (shown in the Home header beside the "YoBite" wordmark — "Yo" coral
  `#E0492F`, "Bite" gold `#F5A623`, Bricolage Grotesque). No recolor needed.
- **`symbol-base-transparent.png`** — the earlier transparent symbol with a **coral** handle.
  Superseded by `symbol-gold-final.png`; kept for history.
- **`symbol-target-goldhandle.png`** — the original gold-handle reference (had a baked-in gradient
  bg, so it couldn't be cleanly cut out). Superseded by the clean `symbol-gold-final.png`.
- **`symbol-issue-annotation.png`** — user's annotation of the old recolor problem (now resolved).

## DONE — logo symbol accurate (2026-06-10)
`public/logo-symbol.png` is now the user's clean transparent gold-handle export
(`symbol-gold-final.png`) — gold handle, fully coral ring, no recolor/hue-shift, no bleed. The
earlier PIL hue-shift approach (recoloring the coral handle on `symbol-base-transparent.png`) is
retired. Verified rendering in the Home header via the `browse` skill (`goto
http://localhost:3000`, screenshot `--selector header`).

The cream **MENU card** still sits on the peach canvas, so the header `<img>` in `app/page.tsx`
keeps a CSS `drop-shadow` to lift the symbol off the background.

**Possible follow-up (not requested):** the Scan-header badge (`public/logo-mark.png`) and the app
icon are the cream-symbol-on-coral lockup — a separate treatment. If we ever want the gold-handle
symbol propagated into those, regenerate them from `symbol-gold-final.png`.
