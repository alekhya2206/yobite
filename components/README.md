# `components/` — shared UI (frontend)

Reusable client UI used across screens. Visuals are bound to `DESIGN.md`.

| File | Role |
|------|------|
| `Deck.tsx` + `Deck.module.css` | The bottom navigation deck (Browse / Saved / Profile) shown on primary screens. |
| `icons.tsx` | Clean line icons (Lucide-style ~2px stroke, warm ink). No emoji in the UI — icons only. |

> The brand logo is shipped as PNGs in `public/` (`logo-symbol.png`,
> `logo-mark.png`, favicons, PWA icons) and referenced directly via `<img>`.
> The old hand-coded SVG `Logo.tsx` was removed (dead code).
