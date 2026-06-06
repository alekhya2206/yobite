# YoBite v2 — Known issues to fix (from live testing, 2026-06-06)

Found while dogfooding the Plan 2 build (branch `plan-2-v2-ui`, PR #3). Fix these next session.
Ordered by priority.

## P1 — Per-meal intent isn't AI-backed (wrong picks for the stated mood)
- **Symptom:** Typed "I want a low-carb meal" → verdict still suggested Grilled Chicken over Chicken Chow Mein; the mood didn't change the result the way it should.
- **Root cause:** `lib/meal/resolveMealGoal` calls the *deterministic* `classifyGoal` regex (LLM intent was deferred to v1.1). "low carb" isn't a recognized keyword → falls through to a `custom` goal, and `lib/ranker` doesn't actually honor low-carb custom goals (no refined-carb penalty for arbitrary custom text).
- **Fix:** Wire the real **LLM intent parser** (`parseIntent` from the AI provider layer, server-side) so free-text/voice mood is genuinely interpreted, AND/OR teach `lib/ranker` to respect a low-carb intent (penalize `profile.refinedCarb`). The "AI not integrated in that part" the user noticed = this.

## P1 — Camera photo capture does nothing (phone + laptop)
- **Symptom:** Camera turns on (light is on) but tapping the shutter captures no photo and produces no verdict. On phone the camera wouldn't open at all.
- **Likely root cause (phone):** `getUserMedia` requires a **secure context** — it only works on `https://` or `localhost`. Opening the app on the phone via `http://192.168.1.54:3000` (LAN IP, not https, not localhost) → the browser blocks the camera. Need HTTPS for LAN testing (e.g. `next dev --experimental-https`, a tunnel like ngrok/cloudflared, or test the deployed https URL).
- **Likely root cause (laptop, camera on but no capture):** `capture()` in `app/scan/page.tsx` guards `if (!video.videoWidth)` and silently falls back to the type panel when the video isn't ready; or the canvas→`/api/scan` call errors silently. Add a "wait for video ready" guard, surface errors instead of swallowing them, and confirm the shutter handler actually fires.
- **Fix:** Debug the full capture path (getUserMedia readiness → canvas draw → base64 → `/api/scan`), add HTTPS for device testing, surface failures.

## P1/P2 — Keyboard keeps popping open on phone
- **Symptom:** On phone, tapping around the UI keeps re-opening the on-screen keyboard.
- **Likely cause:** an input getting focus on mount / on re-render (place input or mood input), or a re-render stealing focus. Audit `autoFocus`, and any effect that focuses an input; ensure inputs only focus on explicit user tap.

## P2 — Remove the "Type it" text option from the Scan screen
- The user never wanted a text/paste fallback on the camera screen. Remove the "Type it" toggle + type panel from `app/scan/page.tsx`. (Keep a graceful path only if camera is truly unavailable — but per the user, the text option should not be a visible option.)

## P2 — Voice needs its own dedicated screen (per the original design)
- **Symptom:** Voice currently just appends to a text buffer. The designed voice flow (spec §4.3) is missing.
- **Expected (from the original discussion):** a **separate Voice screen** — tap-to-lock hands-free listening; spoken dishes transcribe to **chips live**; tap any chip to **fix inline** (correct mis-hears). Build this dedicated screen for the "waiter recites the menu" case.

## P2 — Video/camera capture screen doesn't match the original mockup
- The camera/video screen composition diverges from the first mockup. Rework it to match the designed camera template (and the deferred video-pan flow design) rather than the current single-photo layout.

---

### Context for whoever picks this up
- Branch `plan-2-v2-ui`, open as **PR #3** (github.com/alekhya2206/yobite/pull/3). NOT merged.
- The deterministic ranker (`lib/ranker`) + `/api/scan` + `/api/rank` are from Plan 1 (merged). The AI **intent** parser and **video** scan were deferred to v1.1 in the CEO/eng reviews — issues P1 (intent) and the voice/video items re-open parts of that.
- Design system + mockups: `DESIGN.md`, `docs/design/*.png`. App is light-mode only by decision.
