# `app/` — screens + routes (Next.js App Router)

Frontend screens (client components + their CSS Modules) and the backend HTTP
routes (`app/api/`, documented separately in [api/README.md](api/README.md)).
Each route folder maps to a URL.

## Screens (frontend)

| File | Role |
|------|------|
| `layout.tsx` | Root layout: loads fonts (Bricolage Grotesque display + DM Sans body), global metadata, PWA wiring. Wraps every page. |
| `globals.css` | Global tokens (colors, spacing, type) traced to `DESIGN.md`. |
| `manifest.ts` | PWA web manifest (installable app metadata + icons). |
| `page.tsx` + `page.module.css` | **Landing** (`/`) — the entry hero + nav into scan/browse/profile. |
| `scan/page.tsx` + `scan.module.css` | **Scan** (`/scan`) — capture/paste/voice a menu; downscales the photo and calls `/api/scan`. Stays dark-themed by design. |
| `intent/page.tsx` + `intent.module.css` | **Intent** (`/intent`) — "what are you in the mood for, this meal?"; turns the choice into a mood. |
| `order/page.tsx` + `order.module.css` | **Order** (`/order`) — the verdict poster, the heart of YoBite. Reads the session, ranks via `/api/rank`, renders the pick + reasons; hosts the "Ask" Q&A. |
| `browse/page.tsx` | **Browse** (`/browse`) — secondary nav surface. |
| `saved/page.tsx` | **Saved** (`/saved`) — secondary nav surface. |
| `profile/page.tsx` | **Profile** (`/profile`) — the diner's universal goal/preferences. |

## Routes (backend)
See [`app/api/README.md`](api/README.md).
