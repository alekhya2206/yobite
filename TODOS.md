# TODOS

Deferred work captured during reviews. Each item has enough context to pick up cold.

## Vision-accuracy eval harness
- **What:** A small labeled set of real menu photos (with expected dish lists) scored against the live Gemini read; run on any prompt or model change to catch accuracy regressions.
- **Why:** The scan path (and Plan 2's multi-snap capture) rests entirely on vision accuracy, but there is no number telling us whether a prompt/model change improved or degraded reads — today we'd only learn from users. Spec §6b / T10 calls for it.
- **Current state:** `lib/ai/live-scan.test.ts` is a manual self-skipping smoke test (`MENU_IMAGE=./x.jpg npx vitest run …`) — it proves a read happens, but does not score accuracy against expected output.
- **Where to start:** Add `lib/ai/fixtures/` with a few real menu images + sibling `.expected.json` dish lists; a harness that runs `readMenuFromEnv()` over each and reports precision/recall vs expected. Gate on `GEMINI_API_KEY` like the existing integration test.
- **Depends on:** a handful of real menu photos with hand-labeled dish lists.
- **Surfaced by:** /plan-eng-review of Plan 2 (v2 UI core loop), 2026-06-06.

## Richer web / tablet layout (up to ~1080px)
- **What:** A web/tablet layout beyond the mobile 460px centered column — DESIGN.md notes a ~1080px max content width on web.
- **Why:** Plan 2 ships everything as a phone-width column centered on desktop (correct for the mobile-first PWA + the at-the-restaurant user). DESIGN.md's 1080px web intent should be tracked, not silently dropped.
- **Current state:** `--app-w: 460px` caps every screen; `--maxw: 1080px` is defined but unused.
- **Where to start:** Once there's real web traffic, design intentional desktop layouts (e.g. two-column Browse, wider verdict poster) rather than just widening the column.
- **Depends on:** nothing; a later layout pass.
- **Surfaced by:** /plan-design-review of Plan 2, 2026-06-06.
