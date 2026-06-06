# YoBite v2 UI — Core Verdict Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the app to the Vivid / Sunset Coral / Bricolage design system and build the full local-first verdict loop on top of the already-working AI pipeline: **Home → in-app camera Scan (`/api/scan`) → per-meal Intent → Verdict poster (`/api/rank`) → Plan a full meal**, with goal + active session persisted in the browser. Delete the dead tesseract OCR.

**Architecture:** Next.js 15 App Router, client components for all interactive screens. All real logic lives in pure, node-tested modules (`lib/storage`, `lib/meal`, `lib/scan`); screens are thin shells that call them. Persistence is a single typed `localStorage` module (`lib/storage`) whose guts Plan 3 will swap for Supabase with zero screen churn. The deterministic `lib/ranker` and the existing `/api/scan` + `/api/rank` routes are reused untouched — this plan only adds UI + the client data layer. Design tokens are locked in `globals.css` and guarded by regression tests so the app can never silently drift back to the retired v1 cream/Fraunces look.

**Tech Stack:** Next.js 15 route + client components, React 19, TypeScript, `next/font` (Bricolage Grotesque + DM Sans), CSS Modules + CSS custom properties, Vitest (node for logic, jsdom + Testing Library for components), Web Speech API (`lib/voice.ts`), `getUserMedia` for the in-app camera.

**Scope note:** This is **Plan 2** of the YoBite v2 build (Plan 1 = AI scan→rank pipeline, merged). The library screens — **My Places / Saved / Browse / Restaurant detail / Profile** — are **Plan 2B** and are NOT built here (but the storage layer they need *is* built here). Open-ended **chatbot** ("Ask YoBite") is **v1.1**, deferred per the CEO lock. **Video** frame-sampling scan is deferred per eng-review. **Supabase** auth/DB/sync is **Plan 3**. See `docs/superpowers/specs/2026-06-06-yobite-v2-redesign-design.md` §6a/§7a.

---

## Flow & session state (orientation)

```
 ENTRY PATHS                         THE LOOP                         PERSISTENCE (localStorage)
 ───────────                         ────────                         ──────────────────────────
 Home ──tap Scan FAB──► /scan        /scan:                           yobite:profile { goal, dietary }
 Home ──tap last place─► (revisit)     place name + capture            yobite:session (exactly one)
                                       │  └► downscale ►/api/scan      yobite:places  [ {name,dishes,…} ]
                                       │       └► dishes
                                       ▼
                                     newSession(place, dishes) ───────► save session  + upsertPlace
                                       │
                                       ▼
                                     /intent  "what are you in        on commit:
                                       the mood for?"                   session.goal   = resolveMealGoal(text, profileGoal)
                                       │  (skip → universal goal)       session.ateToday = …
                                       ▼                                session.verdict = undefined   ◄── Issue 2 fix
                                     /order  POST /api/rank ──► poster
                                       │  cache: session.verdict       reopen w/ cached verdict = instant
                                       │  "Plan a full meal" (sheet)
                                       └► End ✕ ──► clearSession ──────► remove session

 SESSION LIFECYCLE:  (none) ──scan/revisit──► active ──End──► (none)
                     active survives reload; Home shows "Dining now" card while active.
 CACHE RULE:  session.verdict is the answer; it MUST be cleared whenever its inputs
              (goal / ateToday) change, else /order shows a stale pick.
```

---

## Review amendments (eng-review 2026-06-06 — ACCEPTED, override the task bodies below)

Four changes were locked in `/plan-eng-review`. Apply them as part of the named tasks; the code here is authoritative where it conflicts with the original task body.

### Amendment 1 → Task 7 + Task 10: harden the scan path (downscale + 20s timeout + 1 retry)

**Task 7 — replace `lib/scan/postScan.ts` with this hardened version** (20s abort + one retry; same signature):

```ts
// lib/scan/postScan.ts
// Client → /api/scan. Downscale happens in the Scan screen before this call.
// Adds a 20s timeout (AbortController) and a single retry so a slow/stalled
// vision call can't hang the UI forever. Throws a user-facing error so the
// Scan screen can fall back to "type it" (never a silent dead end).
const TIMEOUT_MS = 20_000;
const FAIL_MSG = "Couldn't read the menu. Try a clearer photo, or type it.";

async function attempt(imageBase64: string, mimeType: string, fetchFn: typeof fetch): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(FAIL_MSG);
    const data = (await res.json()) as { dishes?: string[] };
    if (!data.dishes || data.dishes.length === 0) throw new Error(FAIL_MSG);
    return data.dishes;
  } finally {
    clearTimeout(timer);
  }
}

export async function postScan(
  imageBase64: string,
  mimeType: string,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  try {
    return await attempt(imageBase64, mimeType, fetchFn);
  } catch {
    // one retry — transient timeout / blip
    return await attempt(imageBase64, mimeType, fetchFn);
  }
}
```

**Task 7 — add these cases to `lib/scan/postScan.test.ts`** (keep the existing three):

```ts
  it("retries once and succeeds on the second attempt", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network blip");
      return { ok: true, json: async () => ({ dishes: ["Dal Tadka"] }) } as unknown as Response;
    });
    expect(await postScan("X", "image/jpeg", fetchFn)).toEqual(["Dal Tadka"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws after both attempts fail", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response);
    await expect(postScan("X", "image/jpeg", fetchFn)).rejects.toThrow(/menu/i);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
```

**Task 10 — replace the `capture()` canvas block** so the frame is downscaled to a ≤1600px longest edge before encoding (smaller upload, lower latency/cost):

```ts
  async function capture() {
    if (!place.trim()) {
      setError("Tell me where you are first.");
      return;
    }
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setShowType(true);
      return;
    }
    setStatus("reading");
    setError("");
    try {
      // Downscale to a 1600px longest edge — plenty for OCR, ~5-10x smaller upload.
      const MAX_EDGE = 1600;
      const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      const dishes = await postScan(base64, "image/jpeg");
      finalize(dishes);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't read the menu. Try typing it.");
      setShowType(true);
    }
  }
```

### Amendment 2 → Task 11 + Task 12: invalidate the verdict cache on input change

**Task 11 — in intent `commit()`, clear the cached verdict whenever goal/ate changes:**

```ts
    saveSession({ ...session, goal, ateToday: ate.trim() || undefined, verdict: undefined });
```

**Task 11 — add an assertion to the "classifies typed intent" test:** after submit, `expect(getSession()?.verdict).toBeUndefined();`

**Task 12 — fix the retry copy** in `app/order/page.tsx`: the error string is `"Couldn't rank the menu just now. Tap to retry."` (the button is "Try again"; there is no pull-to-refresh).

### Amendment 3 → new Task 7b + Tasks 10/11: extract `useVoiceInput`

**New Task 7b — create the hook and its test:**

```ts
// lib/useVoiceInput.ts
"use client";
// Single source of truth for the Web Speech mic wiring used by Scan + Intent.
// Caller supplies what to do with a finalized transcript (append vs replace).
import { useState } from "react";
import { listenOnce, speechSupported } from "@/lib/voice";

export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const supported = speechSupported();

  function start() {
    if (listening || !supported) return;
    setListening(true);
    const handle = listenOnce(
      (text, isFinal) => { if (isFinal) onFinal(text); },
      () => setListening(false),
    );
    if (!handle) setListening(false);
  }

  return { listening, supported, start };
}
```

```tsx
// lib/useVoiceInput.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const listeners: { onResult: (t: string, f: boolean) => void } = { onResult: () => {} };
vi.mock("@/lib/voice", () => ({
  speechSupported: () => true,
  listenOnce: (onResult: (t: string, f: boolean) => void) => {
    listeners.onResult = onResult;
    return { stop: () => {} };
  },
}));

import { useVoiceInput } from "./useVoiceInput";

describe("useVoiceInput", () => {
  it("starts listening and forwards a final transcript", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onFinal));
    expect(result.current.listening).toBe(false);
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => listeners.onResult("grilled chicken", true));
    expect(onFinal).toHaveBeenCalledWith("grilled chicken");
  });

  it("ignores interim (non-final) results", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onFinal));
    act(() => result.current.start());
    act(() => listeners.onResult("grill", false));
    expect(onFinal).not.toHaveBeenCalled();
  });
});
```

Commit: `git commit -m "feat(voice): useVoiceInput hook shared by scan + intent"`.

**Task 10 — Scan uses the hook** (remove the local `listening` state + `recite()` body):

```tsx
  const { listening, supported: voiceSupported, start: startVoice } = useVoiceInput((text) =>
    setTyped((prev) => (prev ? `${prev}\n${text}` : text)),
  );

  function recite() {
    setShowType(true);
    startVoice();
  }
```
Mic button: `disabled={!voiceSupported}`. Drop the direct `speechSupported`/`listenOnce` imports from the screen.

**Task 11 — Intent uses the hook** (remove the local `listening` state + `recite()` body):

```tsx
  const { listening, supported: voiceSupported, start: startVoice } = useVoiceInput((text) => setMood(text));
```
Render the mic when `voiceSupported`, `onClick={startVoice}`. Drop the direct `speechSupported`/`listenOnce` imports from the screen.

### Amendment 4 → Tasks 9 + 12: round out the screen tests

**Task 9 — add to `app/page.test.tsx`:**

```tsx
  it("revisits the last place without re-scanning and routes to intent", async () => {
    const user = userEvent.setup();
    upsertPlace({ name: "Punjabi Dhaba", dishes: ["Paneer Tikka", "Dal Makhani"], lastVisited: 1 });
    render(<Home />);
    await user.click(screen.getByRole("button", { name: /punjabi dhaba/i }));
    expect(getSession()?.dishes).toEqual(["Paneer Tikka", "Dal Makhani"]);
    expect(push).toHaveBeenCalledWith("/intent");
  });
```
Add to the imports/mocks: `import userEvent from "@testing-library/user-event";`, `import { upsertPlace, getSession } from "@/lib/storage";`, and capture `push` from the `useRouter` mock (`const push = vi.fn();` → `useRouter: () => ({ push })`).

**Task 12 — add to `app/order/page.test.tsx`:**

```tsx
  it("renders the cached verdict instantly without calling the API", async () => {
    const result = rank({ menuText: "Grilled Chicken Tikka\nButter Chicken", goal: { id: "high-protein" } });
    saveSession({ ...newSession("Chili's", ["Grilled Chicken Tikka", "Butter Chicken"]), goal: { id: "high-protein" }, verdict: result });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(result.best!.name)).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows an error with a working retry when ranking fails", async () => {
    seedSession();
    const fetchFn = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response);
    vi.stubGlobal("fetch", fetchFn);
    const user = userEvent.setup();
    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/couldn.t rank/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("opens the Plan a full meal sheet with courses", async () => {
    seedSession();
    const result = rank({ menuText: "Paneer Tikka\nButter Chicken\nGulab Jamun", goal: { id: "balanced" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => result }) as unknown as Response));
    const user = userEvent.setup();
    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/order this/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /plan a full meal/i }));
    expect(screen.getByRole("dialog", { name: /plan a full meal/i })).toBeInTheDocument();
    expect(screen.getByText(/dessert/i)).toBeInTheDocument();
  });
```

---

## Outside-voice amendments (eng-review 2026-06-06 — ACCEPTED, override the task bodies below)

An independent reviewer caught these; all accepted. Apply alongside the named tasks.

### OV-1 → Task 10: multi-snap capture (read 4-5 page menus, not just page 1)

Menus are 4-5 pages; one still can't read them. Make Scan **accumulate** dishes across captures, then finalize on "Done". (Video pan stays deferred to v1.1.)

**Task 10 — add accumulation state and rework finalize so capture appends instead of finalizing:**

```tsx
  const [captured, setCaptured] = useState<string[]>([]);

  // capture(): after a successful read, MERGE + dedupe and stay on screen.
  // Replace the `finalize(dishes)` line inside capture()'s try block with:
  const merged = normalizeDishes([...captured, ...dishes]);
  setCaptured(merged);
  setStatus("ready");

  // New: finish the session from everything captured so far.
  function done() {
    if (captured.length === 0) {
      setError("Capture a page or type the menu first.");
      return;
    }
    finalize(captured);
  }

  // useTyped(): merge typed lines into the captured set, then finish:
  function useTyped() {
    if (!place.trim()) { setError("Tell me where you are first."); return; }
    const dishes = normalizeDishes([...captured, ...typed.split("\n")]);
    if (dishes.length === 0) { setError("Add a few dish names first."); return; }
    finalize(dishes);
  }
```

**Task 10 — UI:** after `captured.length > 0`, show a page badge ("`{captured.length}` dishes · `{pageCount}` pages") and a primary **"Done →"** button (calls `done()`) beside **"Add another page"** (re-arms `capture()`). Track `pageCount` (increment on each successful capture). The shutter stays for snapping the next page.

**Task 10 — add a test** (type-path proves accumulation without canvas): capture is QA-verified, but assert that `useTyped` merges across two entries and dedupes — type "Dal Tadka\nPaneer Tikka", then again "paneer tikka\nNaan", Done → session dishes are `["Dal Tadka","Paneer Tikka","Naan"]`.

### OV-2 → Tasks 9, 11, 12: `mounted` gate (kill first-paint flash)

Client screens read localStorage in `useEffect`, so the first paint shows default/blank content (Home flashes "Balanced", `/order` flashes a blank shell before redirect). Gate each screen.

**Task 9 (Home) — add a mounted gate:**
```tsx
  const [mounted, setMounted] = useState(false);
  // at the end of the storage useEffect body, after the three setters:
  setMounted(true);
  // before the main return:
  if (!mounted) return <div className="app" aria-busy="true" />;
```

**Tasks 11 (Intent) & 12 (Order):** they already gate on `ready` / `loading` — ensure the **no-session redirect renders `null`, not a blank shell**: while `router.replace("/")` is pending, return `null` (Intent already returns `null` when `!ready`; Order's redirect branch must `return null` instead of falling through to the loading view).

### OV-3 → new Task 8b: deck placeholder routes (no 404s)

The Deck links to `/browse`, `/saved`, `/profile` (Plan 2B). Add minimal stubs so taps never 404. Plan 2B overwrites them.

**New Task 8b — create three stub pages** (same shape; shown here once, repeat for saved/profile):

```tsx
// app/browse/page.tsx
"use client";
import { Deck } from "@/components/Deck";
import s from "../page.module.css";

export default function BrowsePage() {
  return (
    <div className="app">
      <main className={s.main}>
        <h1 className={s.greet}>Browse</h1>
        <p className={s.sub}>My Places lands here soon.</p>
      </main>
      <Deck />
    </div>
  );
}
```
Create `app/saved/page.tsx` (`Saved` / "Your saved spots land here soon.") and `app/profile/page.tsx` (`Profile` / "Your goal &amp; preferences land here soon.") identically. No new test needed (static). Commit: `git commit -m "feat(ui): placeholder routes for deck tabs (Plan 2B stubs)"`.

### OV-4 → test hygiene (folded; low-risk)

- **Task 12** `app/order/page.test.tsx` — add `vi.unstubAllGlobals();` to `beforeEach` (alongside `vi.restoreAllMocks()`), so a `fetch` stub from one test can't leak into the next (the cached-verdict test asserts `fetch` was NOT called).
- **Task 7b** `useVoiceInput.test.tsx` — the `@/lib/voice` mock must capture the **second** arg too: `listenOnce: (onResult, onEnd) => { listeners.onResult = onResult; listeners.onEnd = onEnd; return { stop: () => {} }; }`. Add a case: after `act(() => listeners.onEnd())`, assert `result.current.listening === false`.
- **Task 10** — add a camera-cleanup test: mock `navigator.mediaDevices.getUserMedia` to resolve a fake stream whose tracks have a `stop` spy; render then unmount; assert `stop` was called (covers the StrictMode/cleanup path that the absent-camera test skips).

---

## Design-review amendments (plan-design-review 2026-06-06 — ACCEPTED)

Three gaps from the design review (visual direction otherwise locked to DESIGN.md + the approved mockups in `docs/design/`). Apply alongside the named tasks.

### DR-1 → Task 12: fix the "Heavier — go easy" contrast (WCAG AA)

`.heavyName` in `--terra` (#BE5E3D) on `.heavyBlock` `--terra-soft` (#F3E2DA) is ~2.8:1 — fails AA. The terra-soft fill + the "Heavier — go easy" label already carry the tier signal; text doesn't need to be terracotta. Make text AA-safe, keep terracotta as a non-text accent:

```css
/* app/order/order.module.css — replace the heavy-block text rules */
.heavyBlock { background: var(--terra-soft); border-color: transparent; border-left: 4px solid var(--terra); }
.heavyBlock .blockTitle { color: var(--ink); }   /* "Heavier — go easy" — AA on terra-soft */
.heavyName { font-weight: 700; color: var(--ink); }      /* was var(--terra) — now AA */
.heavyReason { font-size: 0.82rem; color: var(--muted); }
```
The terracotta tier signal now lives in the **left border + soft fill** (decorative, exempt from text contrast), not in low-contrast text. Verify: dish names readable; left edge reads terracotta. (Dark mode: `--ink` on dark `--terra-soft` already passes.)

### DR-2 → Task 12: make the "thinking → verdict reveal" the signature calm moment

DESIGN.md calls this *the* signature motion ("the answer arrives with a calm settle, gentle rise + fade ~250ms"), but the plan's loading is a generic spinning loader. Replace the spin with a **calm breathing pulse** (no rotation) and let the whole poster settle in on arrival:

```css
/* app/order/order.module.css — replace .dots + @keyframes spin for the loading state */
.thinking { /* unchanged layout */ }
.breath {
  width: 14px; height: 14px; border-radius: var(--r-full); background: var(--coral);
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { transform: scale(0.8); opacity: 0.55; }
  50% { transform: scale(1.15); opacity: 1; }
}
/* the verdict settles in (not just the hero) */
.poster { animation: rise 0.28s ease-out; }
```
Loading copy: "Finding your pick…" (calm, decisive — not "Loading"). In `app/order/page.tsx`, the loading view renders `<span className={s.breath} />` + the copy instead of `<span className={s.dots} />`. `prefers-reduced-motion` already disables the animation via globals. The retry/spinner on the **scan shutter** stays a spinner (it's a control affordance, not the hero reveal).

### DR-3 → Task 9: warm first-run / empty Home

A brand-new user (no session, no saved places) sees only "Hungry?" + a "Balanced" goal card — no nudge toward the one action. Add a warm first-run hint pointing at the Scan FAB (empty states are features):

```tsx
// app/page.tsx — after the goal card, before the session/last-place blocks:
{mounted && !session && lastPlace === null && (
  <div className={s.firstRun}>
    <p className={s.firstRunTitle}>New here?</p>
    <p className={s.firstRunBody}>Tap <span className={s.firstRunScan}>Scan</span> below to read your first menu — I&rsquo;ll pick your order.</p>
  </div>
)}
```
```css
/* app/page.module.css */
.firstRun { background: var(--surface-tint); border: 1px dashed var(--hair); border-radius: var(--r-lg); padding: var(--s-md); }
.firstRunTitle { font-family: var(--display); font-weight: 700; font-size: 1.05rem; }
.firstRunBody { color: var(--muted); font-size: 0.9rem; margin-top: var(--s-2xs); }
.firstRunScan { color: var(--coral); font-weight: 700; }
```
Add a test to `app/page.test.tsx`: with empty storage, `expect(screen.getByText(/new here/i)).toBeInTheDocument()`; and it disappears once a place exists or a session is active.

---

## File structure

**Foundation (restyle the shell)**
- Modify `app/globals.css` — replace v1 tokens with Sunset Coral palette, Bricolage/DM Sans font vars, radii, spacing, and shared app-shell/deck utilities.
- Modify `app/layout.tsx` — load Bricolage Grotesque + DM Sans via `next/font`; update metadata title/themeColor to the coral system.
- Create `app/design-tokens.test.ts` — regression guard: the locked tokens are present and the retired v1 ones are gone.

**Test infrastructure**
- Modify `vitest.config.ts` — add jsdom-capable setup + Testing Library matchers (per-file `// @vitest-environment jsdom` opt-in).
- Create `vitest.setup.ts` — import `@testing-library/jest-dom`.
- Modify `package.json` — add jsdom + Testing Library devDeps (Task 13 removes `tesseract.js`).

**Client data layer (pure, node-tested)**
- Create `lib/storage/types.ts` — `Profile`, `ActiveSession`, `Place`.
- Create `lib/storage/index.ts` — typed, SSR-safe `localStorage` accessors for profile/goal, the single active session, and My Places.
- Create `lib/meal/planFullMeal.ts` — pure: a `RankResult` → best starter / main / dessert.
- Create `lib/meal/resolveMealGoal.ts` — pure: free text + profile goal → the per-meal `Goal` (skip → universal).
- Create `lib/scan/postScan.ts` — POST a base64 image to `/api/scan`, return `dishes[]`.

**Shared UI**
- Create `lib/useVoiceInput.ts` — hook wrapping the Web Speech wiring (`listenOnce`), shared by Scan + Intent (Amendment 3).
- Create `components/icons.tsx` — line icons: `ScanReticle`, `HomeIcon`, `BrowseIcon`, `BookmarkIcon`, `UserIcon`, plus small glyphs used in screens.
- Create `components/Deck.tsx` — persistent bottom deck + center raised Scan FAB.

**Screens**
- Rewrite `app/page.tsx` (+ `app/page.module.css`) — Home: idle + active-session states.
- Rewrite `app/scan/page.tsx` (+ `app/scan/scan.module.css`) — branded in-app camera + place name + voice + type fallback → `/api/scan` → session → `/intent`.
- Create `app/intent/page.tsx` (+ `app/intent/intent.module.css`) — per-meal intent → `/order`.
- Rewrite `app/order/page.tsx` (+ `app/order/order.module.css`) — verdict poster via `/api/rank` + "Plan a full meal" sheet + End session.
- Create `app/browse/page.tsx`, `app/saved/page.tsx`, `app/profile/page.tsx` — deck-tab placeholder stubs (OV-3); Plan 2B replaces them.

**Cleanup**
- Delete `lib/ocr.ts` and remove the `tesseract.js` dependency.

---

## Task 1: Design tokens — rewrite `globals.css` to Sunset Coral + Bricolage

The whole app still renders in the **retired v1 palette** (cream `#FAF6EF`, Fraunces, green brand). Replace the tokens and base shell utilities with the locked v2 system from `DESIGN.md`. A regression test locks the result so we can never silently drift back.

**Files:**
- Modify: `app/globals.css`
- Test: `app/design-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/design-tokens.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

describe("globals.css design tokens (DESIGN.md lock)", () => {
  it("defines the Sunset Coral palette", () => {
    expect(css).toContain("--coral: #E0492F");
    expect(css).toContain("--gold: #F5A623");
    expect(css).toContain("--paper: #FFF1E6");
    expect(css).toContain("--ink: #2A1207");
    expect(css).toContain("--terra: #BE5E3D");
    expect(css).toContain("--green: #2F7A57");
  });

  it("wires the Bricolage + DM Sans font vars", () => {
    expect(css).toMatch(/--display:\s*var\(--font-display\)/);
    expect(css).toContain("Bricolage Grotesque");
    expect(css).toMatch(/--body:\s*var\(--font-body\)/);
  });

  it("does NOT contain any retired v1 tokens", () => {
    expect(css).not.toContain("#FAF6EF"); // v1 cream
    expect(css).not.toContain("Fraunces"); // v1 serif
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/design-tokens.test.ts`
Expected: FAIL — the file still contains `#FAF6EF` / `Fraunces` and lacks `--coral`.

- [ ] **Step 3: Write the new `globals.css`**

Replace the **entire** contents of `app/globals.css` with:

```css
/* YoBite — global styles & design tokens (v2: Vivid / Sunset Coral / Bricolage).
   Values trace to DESIGN.md. Do NOT deviate without updating DESIGN.md.
   Guarded by app/design-tokens.test.ts. */

:root {
  /* Canvas / surface / ink */
  --paper: #FFF1E6; --surface: #FFFFFF; --surface-tint: #FFF6EC;
  --ink: #2A1207; --muted: #7A5230; --muted-soft: #9A7B63;
  /* Identity + action */
  --coral: #E0492F; --gold: #F5A623; --gold-ink: #3A2400;
  /* Signals / tiers */
  --green: #2F7A57; --terra: #BE5E3D;
  /* Lines + soft fills */
  --hair: #F0E2D2;
  --coral-soft: #FAD8C2; --gold-soft: #FFD98A; --green-soft: #E7F0EA; --terra-soft: #F3E2DA;
  /* Type */
  --display: var(--font-display), 'Bricolage Grotesque', system-ui, sans-serif;
  --body: var(--font-body), 'DM Sans', system-ui, -apple-system, sans-serif;
  /* Radii */
  --r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 22px; --r-full: 999px;
  /* Layout */
  --app-w: 460px; --maxw: 1080px; --deck-h: 72px;
  /* Spacing (8px base, 4px substeps) */
  --s-2xs: 2px; --s-xs: 4px; --s-sm: 8px; --s-md: 16px; --s-lg: 24px;
  --s-xl: 32px; --s-2xl: 48px; --s-3xl: 64px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1A130C; --surface: #241A11; --surface-tint: #241A11;
    --ink: #FBEFE2; --muted: #C4A98C; --muted-soft: #C4A98C; --hair: #352819;
    --coral: #FF7A55; --gold: #FFC04D; --gold-ink: #2A1A00;
    --green: #5FB587; --terra: #D8825F;
    --coral-soft: #3A2117; --gold-soft: #33280F; --green-soft: #1E2C24; --terra-soft: #2E2019;
  }
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
body {
  font-family: var(--body); background: var(--paper); color: var(--ink);
  line-height: 1.5; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
a { color: inherit; text-decoration: none; }
button { font-family: var(--body); cursor: pointer; }
:focus-visible { outline: 2.5px solid var(--coral); outline-offset: 2px; border-radius: 6px; }
input, textarea { font-family: var(--body); }

/* ---- app shell ---- */
.app {
  max-width: var(--app-w); margin: 0 auto; min-height: 100dvh; background: var(--paper);
  display: flex; flex-direction: column; position: relative;
  padding-bottom: calc(var(--deck-h) + env(safe-area-inset-bottom, 0px) + var(--s-md));
}
@media (min-width: 481px) { .app { box-shadow: 0 0 0 1px var(--hair); } }

/* numeric chips stay aligned + calm */
.tnum { font-variant-numeric: tabular-nums; }

/* visually-hidden but screen-reader available */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.eyebrow {
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.10em;
  text-transform: uppercase; color: var(--muted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/design-tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/design-tokens.test.ts
git commit -m "feat(ui): v2 Sunset Coral design tokens + lock test"
```

---

## Task 2: Fonts — Bricolage Grotesque + DM Sans in `layout.tsx`

`layout.tsx` still loads **Fraunces** (the retired v1 serif). Swap it for **Bricolage Grotesque** (display) keeping DM Sans (body), and update the metadata + theme color to the coral system.

**Files:**
- Modify: `app/layout.tsx`
- Test: `app/layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/layout.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "layout.tsx"), "utf8");

describe("layout.tsx fonts (DESIGN.md lock)", () => {
  it("loads Bricolage Grotesque as the display font", () => {
    expect(src).toContain("Bricolage_Grotesque");
    expect(src).toContain('variable: "--font-display"');
  });
  it("keeps DM Sans as the body font", () => {
    expect(src).toContain("DM_Sans");
    expect(src).toContain('variable: "--font-body"');
  });
  it("drops the retired Fraunces serif", () => {
    expect(src).not.toContain("Fraunces");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/layout.test.ts`
Expected: FAIL — `Fraunces` is still imported.

- [ ] **Step 3: Write the new `layout.tsx`**

Replace the **entire** contents of `app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

// Bricolage Grotesque — characterful display/brand. DM Sans — razor-legible body.
// Loaded via next/font so they self-host with no layout shift. See DESIGN.md.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YoBite — Order this.",
  description:
    "Scan a local restaurant menu, say what you're in the mood for, and get one confident order with honest reasons. A ranker, not a calorie counter.",
  applicationName: "YoBite",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "YoBite" },
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: {
    title: "YoBite — Order this.",
    description: "Scan a menu, say your mood, get one confident order.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF1E6" },
    { media: "(prefers-color-scheme: dark)", color: "#1A130C" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/layout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/layout.test.ts
git commit -m "feat(ui): load Bricolage Grotesque + DM Sans, coral theme color"
```

---

## Task 3: Component-test infrastructure (jsdom + Testing Library)

The current `vitest.config.ts` runs everything in the **node** environment, which can't render React. Add jsdom + Testing Library so later tasks can opt in per-file with `// @vitest-environment jsdom`. Logic tests stay in node (the default) and are unaffected.

**Files:**
- Modify: `package.json` (devDependencies only)
- Create: `vitest.setup.ts`
- Modify: `vitest.config.ts`
- Test: `app/_smoke.test.tsx` (temporary, deleted in Step 6)

- [ ] **Step 1: Install the test deps**

Run:
```bash
npm install -D jsdom@25 @testing-library/react@16 @testing-library/dom@10 @testing-library/user-event@14 @testing-library/jest-dom@6
```
Expected: the five packages land in `devDependencies` (React 19 compatible: `@testing-library/react@16`).

- [ ] **Step 2: Create the setup file**

```ts
// vitest.setup.ts
// Adds jest-dom matchers (toBeInTheDocument, etc.). Harmless under the node
// environment; only used by files that opt into jsdom.
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Update `vitest.config.ts`**

Replace the **entire** contents with:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx", "components/**/*.test.tsx"],
    environment: "node", // per-file override via `// @vitest-environment jsdom`
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Write a temporary smoke test to prove jsdom + RTL work**

```tsx
// app/_smoke.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("jsdom + Testing Library wiring", () => {
  it("renders and queries a React element", () => {
    render(<button>Order this</button>);
    expect(screen.getByText("Order this")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `npx vitest run app/_smoke.test.tsx`
Expected: PASS (1 test) — confirms jsdom + jest-dom matchers + JSX transform all work.

- [ ] **Step 6: Delete the smoke test, confirm the full suite still passes**

Run:
```bash
rm app/_smoke.test.tsx
npm test
```
Expected: PASS — all Plan 1 tests + Tasks 1–2 token/layout tests, no regressions.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "test: jsdom + Testing Library infra for component tests"
```

---

## Task 4: `lib/storage` — typed, SSR-safe localStorage layer

The single source of truth for the client: the universal **goal/profile**, the one **active session**, and **My Places**. Pure data access with a window guard so it can be imported anywhere. Plan 3 replaces the bodies with Supabase calls; the signatures stay.

**Files:**
- Create: `lib/storage/types.ts`
- Create: `lib/storage/index.ts`
- Test: `lib/storage/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/storage/index.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getProfile, saveProfile, getGoal, saveGoal,
  getSession, saveSession, clearSession, newSession,
  listPlaces, upsertPlace, getPlace,
} from "./index";

beforeEach(() => localStorage.clear());

describe("profile + goal", () => {
  it("returns a balanced default profile when nothing is stored", () => {
    expect(getProfile()).toEqual({ goal: { id: "balanced" }, dietary: [] });
    expect(getGoal()).toEqual({ id: "balanced" });
  });

  it("persists and reloads the universal goal", () => {
    saveGoal({ id: "high-protein" });
    expect(getGoal()).toEqual({ id: "high-protein" });
    expect(getProfile().goal).toEqual({ id: "high-protein" });
  });

  it("persists dietary restrictions without losing the goal", () => {
    saveGoal({ id: "fat-loss" });
    saveProfile({ goal: getGoal(), dietary: ["vegetarian"] });
    expect(getProfile()).toEqual({ goal: { id: "fat-loss" }, dietary: ["vegetarian"] });
  });
});

describe("active session", () => {
  it("is null by default", () => {
    expect(getSession()).toBeNull();
  });

  it("newSession seeds placeName, dishes, the profile goal, and an id", () => {
    saveGoal({ id: "high-protein" });
    const s = newSession("Chili's", ["Grilled Chicken", "Butter Naan"]);
    expect(s.placeName).toBe("Chili's");
    expect(s.dishes).toEqual(["Grilled Chicken", "Butter Naan"]);
    expect(s.goal).toEqual({ id: "high-protein" });
    expect(typeof s.id).toBe("string");
    expect(s.id.length).toBeGreaterThan(0);
  });

  it("saves, reloads, and clears a session (one active at a time)", () => {
    const s = newSession("Chili's", ["Dal Tadka"]);
    saveSession(s);
    expect(getSession()?.placeName).toBe("Chili's");
    // saving a second session replaces the first — only one active
    saveSession(newSession("Punjabi Dhaba", ["Paneer Tikka"]));
    expect(getSession()?.placeName).toBe("Punjabi Dhaba");
    clearSession();
    expect(getSession()).toBeNull();
  });
});

describe("my places", () => {
  it("is empty by default", () => {
    expect(listPlaces()).toEqual([]);
  });

  it("upserts a place and finds it by name (case-insensitive), newest first", () => {
    upsertPlace({ name: "Chili's", dishes: ["A"], lastVisited: 1 });
    upsertPlace({ name: "Punjabi Dhaba", dishes: ["B"], lastVisited: 2 });
    // re-visit updates in place, doesn't duplicate
    upsertPlace({ name: "chili's", dishes: ["A", "C"], lastVisited: 3 });
    const places = listPlaces();
    expect(places).toHaveLength(2);
    expect(places[0].name).toBe("Chili's"); // most recently visited first
    expect(places[0].dishes).toEqual(["A", "C"]);
    expect(getPlace("CHILI'S")?.lastVisited).toBe(3);
    expect(getPlace("unknown")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/storage/index.test.ts`
Expected: FAIL — "Cannot find module './index'".

- [ ] **Step 3: Write the types**

```ts
// lib/storage/types.ts
import type { Goal, RankResult } from "@/lib/ranker/types";

/** The user's universal preferences. Goal defaults per-meal but lives here. */
export interface Profile {
  goal: Goal;
  dietary: string[];
}

/** One active dining session. Persists across app close/reopen. */
export interface ActiveSession {
  id: string;
  placeName: string;
  dishes: string[];
  /** Per-meal goal — seeded from the profile goal, overridden on the intent screen. */
  goal: Goal;
  ateToday?: string;
  startedAt: number;
  /** Cached verdict so re-opening "Back to your picks" is instant. */
  verdict?: RankResult;
}

/** A restaurant the user has scanned — their own library (My Places, Plan 2B). */
export interface Place {
  name: string;
  dishes: string[];
  lastVisited: number;
  verified?: boolean;
}
```

- [ ] **Step 4: Write the implementation**

```ts
// lib/storage/index.ts
// Typed, SSR-safe localStorage layer. The single client source of truth for the
// universal goal/profile, the one active session, and My Places. Every reader
// guards `window` so it is import-safe in server components; every writer is a
// no-op without storage (private mode, SSR). Plan 3 swaps these bodies for
// Supabase without changing a single signature.
import type { Goal } from "@/lib/ranker/types";
import type { ActiveSession, Place, Profile } from "./types";

const K_PROFILE = "yobite:profile";
const K_SESSION = "yobite:session";
const K_PLACES = "yobite:places";

const DEFAULT_PROFILE: Profile = { goal: { id: "balanced" }, dietary: [] };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — degrade silently */
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/* ---- profile + goal ---- */
export function getProfile(): Profile {
  const p = read<Partial<Profile>>(K_PROFILE, DEFAULT_PROFILE);
  return { goal: p.goal ?? DEFAULT_PROFILE.goal, dietary: p.dietary ?? [] };
}
export function saveProfile(p: Profile): void {
  write(K_PROFILE, p);
}
export function getGoal(): Goal {
  return getProfile().goal;
}
export function saveGoal(goal: Goal): void {
  saveProfile({ ...getProfile(), goal });
}

/* ---- active session (exactly one) ---- */
export function newSession(placeName: string, dishes: string[]): ActiveSession {
  return { id: uid(), placeName, dishes, goal: getGoal(), startedAt: Date.now() };
}
export function getSession(): ActiveSession | null {
  return read<ActiveSession | null>(K_SESSION, null);
}
export function saveSession(s: ActiveSession): void {
  write(K_SESSION, s);
}
export function clearSession(): void {
  remove(K_SESSION);
}

/* ---- my places (user library — screens land in Plan 2B) ---- */
export function listPlaces(): Place[] {
  return read<Place[]>(K_PLACES, []).slice().sort((a, b) => b.lastVisited - a.lastVisited);
}
export function getPlace(name: string): Place | null {
  const key = name.trim().toLowerCase();
  return listPlaces().find((p) => p.name.trim().toLowerCase() === key) ?? null;
}
export function upsertPlace(place: Place): void {
  const key = place.name.trim().toLowerCase();
  const others = read<Place[]>(K_PLACES, []).filter((p) => p.name.trim().toLowerCase() !== key);
  write(K_PLACES, [...others, place]);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/storage/index.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/storage/types.ts lib/storage/index.ts lib/storage/index.test.ts
git commit -m "feat(storage): typed localStorage layer (profile/goal, session, places)"
```

---

## Task 5: `lib/meal/planFullMeal` — deterministic full-meal planner

"Plan a full meal" (in v1 per the CEO lock) is **deterministic**, not a chatbot: group the already-ranked dishes by course and take the best of each. `rank().all` is sorted best→worst, so the first match per course is the best pick.

**Files:**
- Create: `lib/meal/planFullMeal.ts`
- Test: `lib/meal/planFullMeal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/meal/planFullMeal.test.ts
import { describe, it, expect } from "vitest";
import { rank } from "@/lib/ranker";
import { planFullMeal } from "./planFullMeal";

describe("planFullMeal", () => {
  it("picks a best starter, main, and dessert from a ranked menu", () => {
    const result = rank({
      menuText: [
        "Paneer Tikka",          // starter
        "Grilled Chicken Tikka", // starter (lean)
        "Butter Chicken",        // main
        "Dal Tadka",             // main
        "Gulab Jamun",           // dessert
      ].join("\n"),
      goal: { id: "high-protein" },
    });
    const meal = planFullMeal(result);
    expect(meal.starter).not.toBeNull();
    expect(["starter", "salad", "soup"]).toContain(meal.starter!.kind);
    expect(meal.main).not.toBeNull();
    expect(["main", "rice"]).toContain(meal.main!.kind);
    expect(meal.dessert?.name).toBe("Gulab Jamun");
  });

  it("returns null for a course the menu doesn't cover", () => {
    const result = rank({ menuText: "Dal Tadka\nButter Chicken", goal: { id: "balanced" } });
    const meal = planFullMeal(result);
    expect(meal.main).not.toBeNull();
    expect(meal.starter).toBeNull();
    expect(meal.dessert).toBeNull();
  });

  it("picks the highest-ranked dish within each course", () => {
    // 'all' is best→worst; the first starter encountered must be the chosen one.
    const result = rank({
      menuText: "Fried Chicken Wings\nGrilled Chicken Salad\nButter Chicken",
      goal: { id: "fat-loss" },
    });
    const meal = planFullMeal(result);
    const starters = result.all.filter((d) => ["starter", "salad", "soup"].includes(d.kind));
    expect(meal.starter?.name).toBe(starters[0]?.name);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/meal/planFullMeal.test.ts`
Expected: FAIL — "Cannot find module './planFullMeal'".

- [ ] **Step 3: Write the implementation**

```ts
// lib/meal/planFullMeal.ts
// Deterministic full-meal planner (NOT a chatbot): group the ranked dishes by
// course and take the best of each. rank().all is already sorted best→worst,
// so the first dish matching a course is that course's best pick.
import type { DishKind, RankResult, RankedDish } from "@/lib/ranker/types";

export type Course = "starter" | "main" | "dessert";

export interface FullMeal {
  starter: RankedDish | null;
  main: RankedDish | null;
  dessert: RankedDish | null;
}

const COURSE_OF: Partial<Record<DishKind, Course>> = {
  starter: "starter", salad: "starter", soup: "starter",
  main: "main", rice: "main",
  dessert: "dessert",
  // bread, side, drink: not a standalone course in the planner
};

export function planFullMeal(result: RankResult): FullMeal {
  const meal: FullMeal = { starter: null, main: null, dessert: null };
  for (const dish of result.all) {
    const course = COURSE_OF[dish.kind];
    if (course && meal[course] === null) {
      meal[course] = dish;
    }
  }
  return meal;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/meal/planFullMeal.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/meal/planFullMeal.ts lib/meal/planFullMeal.test.ts
git commit -m "feat(meal): deterministic planFullMeal (best per course)"
```

---

## Task 6: `lib/meal/resolveMealGoal` — per-meal intent → Goal

The per-meal goal defaults to the universal profile goal and is overridden by free text. **Skip (empty) → universal goal.** Wraps the existing `classifyGoal`.

**Files:**
- Create: `lib/meal/resolveMealGoal.ts`
- Test: `lib/meal/resolveMealGoal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/meal/resolveMealGoal.test.ts
import { describe, it, expect } from "vitest";
import { resolveMealGoal } from "./resolveMealGoal";

describe("resolveMealGoal", () => {
  it("returns the profile goal when the text is empty (skip → universal)", () => {
    expect(resolveMealGoal("", { id: "high-protein" })).toEqual({ id: "high-protein" });
    expect(resolveMealGoal("   ", { id: "fat-loss" })).toEqual({ id: "fat-loss" });
  });

  it("classifies free text into a goal when provided", () => {
    expect(resolveMealGoal("something light, trying to cut", { id: "balanced" }).id).toBe("fat-loss");
    expect(resolveMealGoal("high protein please", { id: "balanced" }).id).toBe("high-protein");
  });

  it("keeps unrecognized intent as a custom goal", () => {
    const g = resolveMealGoal("low carb vegetarian", { id: "balanced" });
    expect(g.id).toBe("custom");
    expect(g.custom).toBe("low carb vegetarian");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/meal/resolveMealGoal.test.ts`
Expected: FAIL — "Cannot find module './resolveMealGoal'".

- [ ] **Step 3: Write the implementation**

```ts
// lib/meal/resolveMealGoal.ts
// The per-meal goal: free text wins; empty falls back to the universal profile
// goal (the "skip" path). The profile goal is not a law for every meal.
import { classifyGoal } from "@/lib/ai/intent";
import type { Goal } from "@/lib/ranker/types";

export function resolveMealGoal(text: string, profileGoal: Goal): Goal {
  if (!text || !text.trim()) return profileGoal;
  return classifyGoal(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/meal/resolveMealGoal.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/meal/resolveMealGoal.ts lib/meal/resolveMealGoal.test.ts
git commit -m "feat(meal): resolveMealGoal (free text wins, skip → universal)"
```

---

## Task 7: `lib/scan/postScan` — client call to `/api/scan`

A thin, testable client helper: send a base64 image to `/api/scan`, return `dishes[]`, throw a clear error on failure so the Scan screen can offer the type-it fallback.

**Files:**
- Create: `lib/scan/postScan.ts`
- Test: `lib/scan/postScan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/postScan.test.ts
import { describe, it, expect, vi } from "vitest";
import { postScan } from "./postScan";

describe("postScan", () => {
  it("posts the image and returns the dish list", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ dishes: ["Paneer Tikka", "Dal Makhani"] }),
    }) as unknown as Response);
    const dishes = await postScan("BASE64", "image/jpeg", fetchFn);
    expect(dishes).toEqual(["Paneer Tikka", "Dal Makhani"]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/scan");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      imageBase64: "BASE64",
      mimeType: "image/jpeg",
    });
  });

  it("throws when the response is not ok", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response);
    await expect(postScan("X", "image/jpeg", fetchFn)).rejects.toThrow(/menu/i);
  });

  it("throws when no dishes come back", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ dishes: [] }) }) as unknown as Response);
    await expect(postScan("X", "image/jpeg", fetchFn)).rejects.toThrow(/menu/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scan/postScan.test.ts`
Expected: FAIL — "Cannot find module './postScan'".

- [ ] **Step 3: Write the implementation**

```ts
// lib/scan/postScan.ts
// Client → /api/scan. Returns the dish list, or throws a user-facing error so
// the Scan screen can fall back to "type it" (never a silent dead end).
export async function postScan(
  imageBase64: string,
  mimeType: string,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  const res = await fetchFn("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  if (!res.ok) {
    throw new Error("Couldn't read the menu. Try a clearer photo, or type it.");
  }
  const data = (await res.json()) as { dishes?: string[] };
  if (!data.dishes || data.dishes.length === 0) {
    throw new Error("Couldn't read the menu. Try a clearer photo, or type it.");
  }
  return data.dishes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scan/postScan.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/postScan.ts lib/scan/postScan.test.ts
git commit -m "feat(scan): postScan client helper for /api/scan"
```

---

## Task 8: Shared UI — line icons + bottom Deck with Scan FAB

The persistent navigation: a white bottom **deck** (`Home · Browse | [Scan FAB] | Saved · Profile`) with a raised coral **Scan FAB** carrying the scan-reticle. Browse/Saved/Profile route to placeholder paths (their screens are Plan 2B) but the deck is final.

**Files:**
- Create: `components/icons.tsx`
- Create: `components/Deck.tsx`
- Create: `components/Deck.module.css`
- Test: `components/Deck.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/Deck.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Deck } from "./Deck";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("Deck", () => {
  it("renders the four tabs and the Scan FAB", () => {
    render(<Deck />);
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scan/i })).toHaveAttribute("href", "/scan");
  });

  it("marks the current tab as active", () => {
    render(<Deck />);
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/Deck.test.tsx`
Expected: FAIL — "Cannot find module './Deck'".

- [ ] **Step 3: Write the icons**

```tsx
// components/icons.tsx
// Clean line icons (Lucide-style ~2px stroke), warm ink by default. No emoji in
// chrome. The Scan mark is a reticle (corner brackets + sweep line), never a camera.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, ...props,
  };
}

export function ScanReticle(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
      <path d="M4 16v3a1 1 0 0 0 1 1h3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function BrowseIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M7 3v18" />
      <path d="M5 3v5a2 2 0 0 0 4 0V3" />
      <path d="M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4" />
      <path d="M17 12v9" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M6 4h12v16l-6-4-6 4z" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
```

- [ ] **Step 4: Write the Deck component**

```tsx
// components/Deck.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkIcon, BrowseIcon, HomeIcon, ScanReticle, UserIcon,
} from "./icons";
import s from "./Deck.module.css";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/browse", label: "Browse", Icon: BrowseIcon },
  { href: "/saved", label: "Saved", Icon: BookmarkIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export function Deck() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className={s.deck} aria-label="Primary">
      <div className={s.row}>
        {TABS.slice(0, 2).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${s.tab}${isActive(href) ? ` ${s.active}` : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}

        <Link href="/scan" className={s.fab} aria-label="Scan a menu">
          <ScanReticle size={26} />
        </Link>

        {TABS.slice(2).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${s.tab}${isActive(href) ? ` ${s.active}` : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Write the Deck styles**

```css
/* components/Deck.module.css */
.deck {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
  display: flex; justify-content: center;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  pointer-events: none;
}
.row {
  pointer-events: auto;
  width: 100%; max-width: var(--app-w);
  height: var(--deck-h);
  display: grid; grid-template-columns: 1fr 1fr auto 1fr 1fr; align-items: center;
  background: var(--surface);
  border-top: 1px solid var(--hair);
  box-shadow: 0 -6px 20px -12px rgba(42, 18, 7, 0.18);
}
.tab {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  color: var(--muted); font-size: 0.68rem; font-weight: 600;
}
.tab.active { color: var(--coral); }
.fab {
  display: flex; align-items: center; justify-content: center;
  width: 60px; height: 60px; margin-top: -22px; justify-self: center;
  border-radius: var(--r-full);
  background: var(--coral); color: #fff;
  box-shadow: 0 8px 22px -6px rgba(224, 73, 47, 0.6);
  animation: fab-pulse 2.8s ease-in-out infinite;
}
@keyframes fab-pulse {
  0%, 100% { box-shadow: 0 8px 22px -6px rgba(224, 73, 47, 0.6); }
  50% { box-shadow: 0 8px 22px -6px rgba(224, 73, 47, 0.6), 0 0 0 8px rgba(224, 73, 47, 0.12); }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run components/Deck.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add components/icons.tsx components/Deck.tsx components/Deck.module.css components/Deck.test.tsx
git commit -m "feat(ui): line icons + bottom deck with center Scan FAB"
```

---

## Task 9: Home screen — idle + active-session states

Rewrite `app/page.tsx` to the v2 Home: greeting · coral **goal card** · (when a session is active) an **active dining card directly below the goal card** with "Back to your picks →" and "End ✕" · a last-visit card from My Places. Reads everything from `lib/storage` on mount (client).

**Files:**
- Rewrite: `app/page.tsx`
- Rewrite: `app/page.module.css`
- Test: `app/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// app/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { saveGoal, saveSession, newSession } from "@/lib/storage";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

import Home from "./page";

beforeEach(() => localStorage.clear());

describe("Home", () => {
  it("shows the universal goal label on the goal card", () => {
    saveGoal({ id: "high-protein" });
    render(<Home />);
    expect(screen.getByText(/high protein/i)).toBeInTheDocument();
  });

  it("shows no active-session card when there is no session", () => {
    render(<Home />);
    expect(screen.queryByText(/dining now/i)).not.toBeInTheDocument();
  });

  it("shows the active dining card when a session exists", () => {
    saveSession(newSession("Chili's", ["Grilled Chicken", "Dal Tadka"]));
    render(<Home />);
    expect(screen.getByText(/dining now/i)).toBeInTheDocument();
    expect(screen.getByText(/chili's/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to your picks/i })).toHaveAttribute("href", "/order");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — the current Home renders the v1 landing page, not the goal/session cards.

- [ ] **Step 3: Write the new Home**

```tsx
// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Deck } from "@/components/Deck";
import { CloseIcon } from "@/components/icons";
import {
  clearSession, getGoal, getSession, listPlaces, newSession, saveSession,
} from "@/lib/storage";
import { goalLabel } from "@/lib/ranker";
import type { ActiveSession, Place } from "@/lib/storage/types";
import s from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const [goalText, setGoalText] = useState("");
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastPlace, setLastPlace] = useState<Place | null>(null);

  // Client-only: read persisted state after mount (avoids SSR/storage mismatch).
  useEffect(() => {
    setGoalText(goalLabel(getGoal()));
    setSession(getSession());
    setLastPlace(listPlaces()[0] ?? null);
  }, []);

  function endSession() {
    clearSession();
    setSession(null);
  }

  // Revisit a saved place WITHOUT re-scanning — start a session from its cached
  // menu and go straight to the per-meal intent.
  function revisit(p: Place) {
    saveSession(newSession(p.name, p.dishes));
    router.push("/intent");
  }

  return (
    <div className="app">
      <main className={s.main}>
        <header className={s.head}>
          <div>
            <p className={s.brand}>YoBite</p>
            <h1 className={s.greet}>Hungry?</h1>
            <p className={s.sub}>Point me at the menu — I&rsquo;ll pick.</p>
          </div>
        </header>

        <Link href="/scan" className={s.goalCard}>
          <span className={s.goalEyebrow}>Your goal</span>
          <span className={s.goalName}>{goalText || "Balanced"}</span>
        </Link>

        {session && (
          <section className={s.sessionCard} aria-label="Active dining session">
            <div className={s.sessionTop}>
              <span className={s.diningNow}>● Dining now</span>
              <button className={s.endBtn} onClick={endSession} aria-label="End session">
                End <CloseIcon size={14} />
              </button>
            </div>
            <p className={s.sessionPlace}>You&rsquo;re at {session.placeName}</p>
            <p className={s.sessionMeta}>
              <span className="tnum">{session.dishes.length}</span> dishes · no need to re-scan
            </p>
            <Link href="/order" className={s.backToPicks}>
              Back to your picks →
            </Link>
          </section>
        )}

        {lastPlace && !session && (
          <button className={s.lastCard} onClick={() => revisit(lastPlace)}>
            <span className="eyebrow">Last you visited</span>
            <span className={s.lastName}>{lastPlace.name}</span>
            <span className={`${s.lastMeta} tnum`}>{lastPlace.dishes.length} dishes saved · tap to re-pick</span>
          </button>
        )}
      </main>

      <Deck />
    </div>
  );
}
```

- [ ] **Step 4: Write the Home styles**

```css
/* app/page.module.css */
.main { flex: 1; padding: var(--s-xl) var(--s-md) var(--s-lg); display: flex; flex-direction: column; gap: var(--s-md); }
.head { margin-bottom: var(--s-xs); }
.brand { font-family: var(--display); font-weight: 800; font-size: 1.1rem; color: var(--coral); letter-spacing: -0.01em; }
.greet { font-family: var(--display); font-weight: 800; font-size: 2.4rem; letter-spacing: -0.02em; line-height: 1.05; margin-top: var(--s-sm); }
.sub { color: var(--muted); margin-top: var(--s-2xs); }

.goalCard {
  display: flex; flex-direction: column; gap: var(--s-xs);
  background: var(--coral); color: #fff;
  border-radius: var(--r-xl); padding: var(--s-lg);
  box-shadow: 0 10px 28px -14px rgba(224, 73, 47, 0.7);
}
.goalEyebrow { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; opacity: 0.85; }
.goalName { font-family: var(--display); font-weight: 800; font-size: 1.7rem; letter-spacing: -0.01em; }

.sessionCard {
  background: var(--surface); border: 1px solid var(--hair);
  border-radius: var(--r-lg); padding: var(--s-md); display: flex; flex-direction: column; gap: var(--s-xs);
}
.sessionTop { display: flex; align-items: center; justify-content: space-between; }
.diningNow { color: var(--green); font-size: 0.8rem; font-weight: 700; }
.endBtn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--muted); font-size: 0.8rem; font-weight: 600; }
.sessionPlace { font-family: var(--display); font-weight: 700; font-size: 1.25rem; }
.sessionMeta { color: var(--muted); font-size: 0.85rem; }
.backToPicks {
  margin-top: var(--s-sm); align-self: flex-start;
  background: var(--gold); color: var(--gold-ink); font-weight: 700;
  padding: var(--s-sm) var(--s-md); border-radius: var(--r-full);
}

.lastCard {
  text-align: left; display: flex; flex-direction: column; gap: var(--s-2xs);
  background: var(--surface-tint); border: 1px solid var(--hair);
  border-radius: var(--r-lg); padding: var(--s-md);
}
.lastName { font-family: var(--display); font-weight: 700; font-size: 1.1rem; }
.lastMeta { color: var(--muted); font-size: 0.85rem; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.module.css app/page.test.tsx
git commit -m "feat(ui): v2 Home — goal card + active session card"
```

---

## Task 10: Scan screen — in-app camera + place name + voice + type fallback

Rewrite `app/scan/page.tsx` to the branded in-app camera. **Place name first** (needed for the session + My Places), then a live `getUserMedia` viewport with the coral frame guide, a capture button → `/api/scan` (via `postScan`), a voice path (recite dishes), and an always-available **type-it fallback** (never a silent dead end). On a successful read it creates the active session and routes to `/intent`.

**Files:**
- Rewrite: `app/scan/page.tsx`
- Rewrite: `app/scan/scan.module.css`
- Test: `app/scan/page.test.tsx`

- [ ] **Step 1: Write the failing test**

The camera path needs a real `<canvas>`/`getUserMedia`, so the test covers the **type-it fallback** path (place name + pasted menu → session → route to `/intent`). The camera capture path is verified in QA (see Verification).

```tsx
// app/scan/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getSession } from "@/lib/storage";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/scan" }));
// jsdom has no camera; the screen must degrade to the type-it fallback, not crash.
vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });

import ScanPage from "./page";

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
});

describe("Scan — type-it fallback", () => {
  it("creates a session from a place name + pasted menu and routes to intent", async () => {
    const user = userEvent.setup();
    render(<ScanPage />);

    await user.type(screen.getByLabelText(/place name/i), "Punjabi Dhaba");
    // open the type-it fallback
    await user.click(screen.getByRole("button", { name: /type it/i }));
    await user.type(
      screen.getByLabelText(/paste the menu/i),
      "Paneer Tikka\nDal Makhani\nButter Naan",
    );
    await user.click(screen.getByRole("button", { name: /use this menu/i }));

    const session = getSession();
    expect(session?.placeName).toBe("Punjabi Dhaba");
    expect(session?.dishes).toEqual(["Paneer Tikka", "Dal Makhani", "Butter Naan"]);
    expect(push).toHaveBeenCalledWith("/intent");
  });

  it("requires a place name before a menu can be used", async () => {
    const user = userEvent.setup();
    render(<ScanPage />);
    await user.click(screen.getByRole("button", { name: /type it/i }));
    await user.type(screen.getByLabelText(/paste the menu/i), "Dal Tadka");
    await user.click(screen.getByRole("button", { name: /use this menu/i }));
    expect(getSession()).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/scan/page.test.tsx`
Expected: FAIL — the current Scan page uses tesseract OCR + the old goal UI; it has no place-name field or type-it fallback.

- [ ] **Step 3: Write the new Scan page**

```tsx
// app/scan/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon, MicIcon, ScanReticle } from "@/components/icons";
import { postScan } from "@/lib/scan/postScan";
import { newSession, saveSession, upsertPlace } from "@/lib/storage";
import { normalizeDishes } from "@/lib/ai/normalizeDishes";
import { listenOnce, speechSupported } from "@/lib/voice";
import s from "./scan.module.css";

type Status = "ready" | "reading" | "error";

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [place, setPlace] = useState("");
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [showType, setShowType] = useState(false);
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);

  // Start the in-app camera. Falls back to "type it" if denied/unsupported.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setShowType(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraOn(true);
      } catch {
        setShowType(true);
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Finalize: persist a session + place, then go to per-meal intent.
  const finalize = useCallback(
    (dishes: string[]) => {
      const session = newSession(place.trim(), dishes);
      saveSession(session);
      upsertPlace({ name: place.trim(), dishes, lastVisited: Date.now() });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      router.push("/intent");
    },
    [place, router],
  );

  async function capture() {
    if (!place.trim()) {
      setError("Tell me where you are first.");
      return;
    }
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setShowType(true);
      return;
    }
    setStatus("reading");
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      const dishes = await postScan(base64, "image/jpeg");
      finalize(dishes);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't read the menu. Try typing it.");
      setShowType(true);
    }
  }

  function useTyped() {
    if (!place.trim()) {
      setError("Tell me where you are first.");
      return;
    }
    const dishes = normalizeDishes(typed.split("\n"));
    if (dishes.length === 0) {
      setError("Add a few dish names first.");
      return;
    }
    finalize(dishes);
  }

  function recite() {
    if (listening || !speechSupported()) return;
    setListening(true);
    setShowType(true);
    const handle = listenOnce(
      (text, isFinal) => { if (isFinal) setTyped((prev) => (prev ? `${prev}\n${text}` : text)); },
      () => setListening(false),
    );
    if (!handle) setListening(false);
  }

  return (
    <div className={`app ${s.scanApp}`}>
      <header className={s.bar}>
        <Link href="/" className={s.back} aria-label="Back">
          <BackIcon size={20} />
        </Link>
        <span className={s.brand}>YoBite</span>
        <span className={s.barSpacer} />
      </header>

      <div className={s.placeRow}>
        <label htmlFor="place" className="sr-only">Place name</label>
        <input
          id="place"
          className={s.placeInput}
          placeholder="Where are you? (e.g. Chili's)"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
      </div>

      <div className={s.viewport}>
        <video ref={videoRef} className={s.video} autoPlay playsInline muted />
        {!cameraOn && <div className={s.viewportHint}>Point your camera at the menu</div>}
        <div className={s.frame} aria-hidden="true" />
        <p className={s.frameNote}>Fit each page inside the frame · hold steady</p>
      </div>

      <div className={s.controls}>
        <button
          className={`${s.mic}${listening ? ` ${s.listening}` : ""}`}
          onClick={recite}
          aria-label={listening ? "Listening…" : "Say the dishes"}
          disabled={!speechSupported()}
        >
          <MicIcon size={20} />
        </button>
        <button className={s.shutter} onClick={capture} disabled={status === "reading"} aria-label="Capture menu">
          {status === "reading" ? <span className={s.spinner} /> : <ScanReticle size={28} />}
        </button>
        <button className={s.typeToggle} onClick={() => setShowType((v) => !v)}>
          Type it
        </button>
      </div>

      {status === "reading" && <p className={s.reading}>Reading the menu…</p>}
      {error && <p className={s.error}>{error}</p>}

      {showType && (
        <div className={s.typePanel}>
          <label htmlFor="typed" className="sr-only">Paste the menu</label>
          <textarea
            id="typed"
            className={s.textarea}
            placeholder="Paste or say the menu — one dish per line."
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className={s.useBtn} onClick={useTyped}>Use this menu →</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the Scan styles**

```css
/* app/scan/scan.module.css */
.scanApp { background: #1a130c; color: #fff; padding-bottom: var(--s-lg); }
.bar { display: flex; align-items: center; gap: var(--s-sm); padding: var(--s-md); }
.back { display: flex; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: var(--r-full); background: rgba(255,255,255,0.08); color: #fff; }
.brand { font-family: var(--display); font-weight: 800; color: var(--coral); }
.barSpacer { flex: 1; }

.placeRow { padding: 0 var(--s-md) var(--s-sm); }
.placeInput {
  width: 100%; padding: var(--s-sm) var(--s-md); border-radius: var(--r-full);
  border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06);
  color: #fff; font-size: 1rem;
}
.placeInput::placeholder { color: rgba(255,255,255,0.5); }

.viewport { position: relative; margin: 0 var(--s-md); border-radius: var(--r-xl); overflow: hidden; aspect-ratio: 3/4; background: #000; }
.video { width: 100%; height: 100%; object-fit: cover; }
.viewportHint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); font-size: 0.9rem; }
.frame { position: absolute; inset: 18px; border: 2px solid var(--coral); border-radius: var(--r-lg); box-shadow: 0 0 0 9999px rgba(0,0,0,0.18); pointer-events: none; }
.frameNote { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; font-size: 0.78rem; color: rgba(255,255,255,0.75); }

.controls { display: flex; align-items: center; justify-content: space-between; padding: var(--s-lg) var(--s-xl); }
.mic, .typeToggle {
  width: 52px; height: 44px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--r-full); border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.06); color: #fff; font-size: 0.85rem; font-weight: 600;
}
.mic.listening { animation: mic-pulse 1.1s ease-in-out infinite; border-color: var(--coral); }
@keyframes mic-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(224,73,47,0.5); } 50% { box-shadow: 0 0 0 8px rgba(224,73,47,0); } }
.shutter {
  width: 72px; height: 72px; border-radius: var(--r-full);
  background: var(--coral); color: #fff; border: 4px solid rgba(255,255,255,0.85);
  display: flex; align-items: center; justify-content: center;
}
.spinner { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: var(--r-full); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.reading { text-align: center; color: rgba(255,255,255,0.8); }
.error { text-align: center; color: #ffb59c; padding: 0 var(--s-md); }

.typePanel { padding: var(--s-md); display: flex; flex-direction: column; gap: var(--s-sm); }
.textarea {
  min-height: 140px; padding: var(--s-md); border-radius: var(--r-md);
  border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #fff;
  font-size: 1rem; line-height: 1.6; resize: vertical;
}
.useBtn { align-self: flex-end; background: var(--gold); color: var(--gold-ink); font-weight: 700; padding: var(--s-sm) var(--s-lg); border: none; border-radius: var(--r-full); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/scan/page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/scan/page.tsx app/scan/scan.module.css app/scan/page.test.tsx
git commit -m "feat(ui): in-app camera Scan + place name + voice + type fallback"
```

---

## Task 11: Per-meal intent screen

A new `/intent` route: the AI checks in — **"What are you in the mood for — this meal?"** — with a free-text + voice field, optional shortcut chips, and an optional "Eaten anything earlier today?" field. Skip → universal goal. On submit it resolves the goal, updates the active session, and routes to `/order`.

**Files:**
- Create: `app/intent/page.tsx`
- Create: `app/intent/intent.module.css`
- Test: `app/intent/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// app/intent/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newSession, saveSession, getSession, saveGoal } from "@/lib/storage";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/intent" }));

import IntentPage from "./page";

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  replace.mockClear();
});

describe("Per-meal intent", () => {
  it("classifies typed intent onto the session and routes to the verdict", async () => {
    const user = userEvent.setup();
    saveSession(newSession("Chili's", ["Grilled Chicken", "Dal Tadka"]));
    render(<IntentPage />);

    await user.type(screen.getByLabelText(/mood/i), "something light, trying to cut");
    await user.type(screen.getByLabelText(/eaten/i), "rice and dal at lunch");
    await user.click(screen.getByRole("button", { name: /find my pick/i }));

    const session = getSession();
    expect(session?.goal.id).toBe("fat-loss");
    expect(session?.ateToday).toBe("rice and dal at lunch");
    expect(push).toHaveBeenCalledWith("/order");
  });

  it("skips to the universal goal when nothing is typed", async () => {
    const user = userEvent.setup();
    saveGoal({ id: "high-protein" });
    saveSession(newSession("Chili's", ["Grilled Chicken"]));
    render(<IntentPage />);

    await user.click(screen.getByRole("button", { name: /skip/i }));

    expect(getSession()?.goal.id).toBe("high-protein");
    expect(push).toHaveBeenCalledWith("/order");
  });

  it("redirects home when there is no active session", () => {
    render(<IntentPage />);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/intent/page.test.tsx`
Expected: FAIL — "Cannot find module './page'".

- [ ] **Step 3: Write the intent page**

```tsx
// app/intent/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, MicIcon } from "@/components/icons";
import { getGoal, getSession, saveSession } from "@/lib/storage";
import { resolveMealGoal } from "@/lib/meal/resolveMealGoal";
import { listenOnce, speechSupported } from "@/lib/voice";
import s from "./intent.module.css";

const SHORTCUTS = ["High protein", "Something lighter", "Just the tastiest"];

export default function IntentPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mood, setMood] = useState("");
  const [ate, setAte] = useState("");
  const [dishCount, setDishCount] = useState(0);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setDishCount(session.dishes.length);
    setReady(true);
  }, [router]);

  function commit(text: string) {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    const goal = resolveMealGoal(text, getGoal());
    saveSession({ ...session, goal, ateToday: ate.trim() || undefined });
    router.push("/order");
  }

  function recite() {
    if (listening || !speechSupported()) return;
    setListening(true);
    const handle = listenOnce(
      (text, isFinal) => { if (isFinal) setMood(text); },
      () => setListening(false),
    );
    if (!handle) setListening(false);
  }

  if (!ready) return null;

  return (
    <div className="app">
      <header className={s.bar}>
        <button className={s.back} onClick={() => router.back()} aria-label="Back">
          <BackIcon size={20} />
        </button>
        <span className="tnum">{dishCount} dishes read</span>
      </header>

      <main className={s.main}>
        <h1 className={s.q}>What are you in the mood for — this meal?</h1>

        <label htmlFor="mood" className="sr-only">Your mood this meal</label>
        <div className={s.field}>
          <input
            id="mood"
            className={s.input}
            placeholder="e.g. high protein but not too heavy"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
          {speechSupported() && (
            <button
              className={`${s.mic}${listening ? ` ${s.listening}` : ""}`}
              onClick={recite}
              aria-label={listening ? "Listening…" : "Say it"}
            >
              <MicIcon size={18} />
            </button>
          )}
        </div>

        <div className={s.shortcuts}>
          <span className={s.orPick}>or pick one</span>
          {SHORTCUTS.map((sc) => (
            <button key={sc} className={s.chip} onClick={() => setMood(sc)}>{sc}</button>
          ))}
        </div>

        <label htmlFor="ate" className={s.ateLabel}>
          Eaten anything earlier? <span className={s.optional}>optional</span>
        </label>
        <input
          id="ate"
          className={s.input}
          placeholder="e.g. 2 eggs & a banana"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />
      </main>

      <div className={s.dock}>
        <button className={s.cta} onClick={() => commit(mood)}>Find my pick →</button>
        <button className={s.skip} onClick={() => commit("")}>Skip — just use my usual goal</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the intent styles**

```css
/* app/intent/intent.module.css */
.bar { display: flex; align-items: center; gap: var(--s-sm); padding: var(--s-md); color: var(--muted); font-size: 0.85rem; }
.back { display: flex; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: var(--r-full); border: 1px solid var(--hair); background: var(--surface); color: var(--ink); }
.main { flex: 1; padding: var(--s-sm) var(--s-md) var(--s-lg); display: flex; flex-direction: column; gap: var(--s-md); }
.q { font-family: var(--display); font-weight: 800; font-size: 1.7rem; letter-spacing: -0.01em; line-height: 1.1; }

.field { display: flex; gap: var(--s-sm); align-items: center; }
.input { flex: 1; padding: var(--s-md); border-radius: var(--r-md); border: 1px solid var(--hair); background: var(--surface); color: var(--ink); font-size: 1rem; }
.mic { width: 48px; height: 48px; flex-shrink: 0; border-radius: var(--r-full); border: none; background: var(--coral); color: #fff; display: flex; align-items: center; justify-content: center; }
.mic.listening { animation: mic-pulse 1.1s ease-in-out infinite; }
@keyframes mic-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(224,73,47,0.45); } 50% { box-shadow: 0 0 0 8px rgba(224,73,47,0); } }

.shortcuts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-sm); }
.orPick { font-size: 0.78rem; color: var(--muted); margin-right: var(--s-2xs); }
.chip { padding: var(--s-xs) var(--s-md); border-radius: var(--r-full); border: 1px solid var(--hair); background: var(--gold-soft); color: var(--ink); font-size: 0.85rem; font-weight: 600; }

.ateLabel { margin-top: var(--s-sm); font-weight: 600; }
.optional { color: var(--muted); font-weight: 400; font-size: 0.85rem; }

.dock { padding: var(--s-md); display: flex; flex-direction: column; gap: var(--s-sm); }
.cta { background: var(--gold); color: var(--gold-ink); font-weight: 800; font-size: 1.05rem; padding: var(--s-md); border: none; border-radius: var(--r-full); }
.skip { background: none; border: none; color: var(--muted); font-size: 0.9rem; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/intent/page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/intent/page.tsx app/intent/intent.module.css app/intent/page.test.tsx
git commit -m "feat(ui): per-meal intent screen (free-text/voice → goal)"
```

---

## Task 12: Verdict poster + Plan-a-full-meal + End session

Rewrite `app/order/page.tsx` to the **poster**: a coral "Order this" hero (dish in Bricolage + reason chips), white "Also good" rows with green checks, a terracotta "Heavier — go easy" card, and a corner **"Plan a full meal"** action that opens a sheet (deterministic, via `planFullMeal`). The verdict is cached on the session; **End ✕** clears the session and returns Home. No bottom CTAs (it's a suggestion, never an order). The chatbot FAB is **not** built (v1.1).

**Files:**
- Rewrite: `app/order/page.tsx`
- Rewrite: `app/order/order.module.css`
- Test: `app/order/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// app/order/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newSession, saveSession, getSession } from "@/lib/storage";
import { rank } from "@/lib/ranker";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/order" }));

import OrderPage from "./page";

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  replace.mockClear();
  vi.restoreAllMocks();
});

function seedSession() {
  saveSession({
    ...newSession("Chili's", ["Grilled Chicken Tikka", "Butter Chicken", "Gulab Jamun"]),
    goal: { id: "high-protein" },
  });
}

describe("Verdict poster", () => {
  it("ranks the session dishes and renders the hero pick", async () => {
    seedSession();
    const result = rank({ menuText: "Grilled Chicken Tikka\nButter Chicken\nGulab Jamun", goal: { id: "high-protein" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => result }) as unknown as Response));

    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/order this/i)).toBeInTheDocument());
    expect(screen.getByText(result.best!.name)).toBeInTheDocument();
  });

  it("End clears the session and routes home", async () => {
    seedSession();
    const result = rank({ menuText: "Grilled Chicken Tikka\nButter Chicken", goal: { id: "high-protein" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => result }) as unknown as Response));
    const user = userEvent.setup();

    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/order this/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /end/i }));

    expect(getSession()).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("redirects home when there is no active session", () => {
    render(<OrderPage />);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/order/page.test.tsx`
Expected: FAIL — the current `/order` renders the v1 result via `lib/store`, not the session-driven poster.

- [ ] **Step 3: Write the new verdict page**

```tsx
// app/order/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { clearSession, getSession, saveSession } from "@/lib/storage";
import { planFullMeal, type FullMeal } from "@/lib/meal/planFullMeal";
import type { RankResult, RankedDish } from "@/lib/ranker/types";
import s from "./order.module.css";

export default function OrderPage() {
  const router = useRouter();
  const [result, setResult] = useState<RankResult | null>(null);
  const [place, setPlace] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meal, setMeal] = useState<FullMeal | null>(null);

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setPlace(session.placeName);
    // Cached verdict → instant ("Back to your picks" re-open).
    if (session.verdict) {
      setResult(session.verdict);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishes: session.dishes,
          goalId: session.goal.id === "custom" ? undefined : session.goal.id,
          goalText: session.goal.custom,
          ateToday: session.ateToday,
        }),
      });
      if (!res.ok) throw new Error("rank failed");
      const data = (await res.json()) as RankResult;
      setResult(data);
      saveSession({ ...session, verdict: data });
    } catch {
      setError("Couldn't rank the menu just now. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function end() {
    clearSession();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="app">
        <div className={s.thinking}>
          <span className={s.dots} aria-hidden="true" />
          <p>Reading the menu for you…</p>
        </div>
      </div>
    );
  }

  if (error || !result || !result.best) {
    return (
      <div className="app">
        <div className={s.thinking}>
          <p>{error || "Nothing rankable on this menu."}</p>
          <button className={s.retry} onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  const best = result.best;

  return (
    <div className="app">
      <header className={s.bar}>
        <span className={s.place}>{place}</span>
        <button className={s.end} onClick={end} aria-label="End session">
          End <CloseIcon size={14} />
        </button>
      </header>

      <main className={s.poster}>
        <section className={s.hero}>
          <span className={s.heroEyebrow}>Order this · {result.goalLabel}</span>
          <h1 className={s.heroName}>{best.name}</h1>
          <div className={s.chips}>
            {best.chips.map((c) => <span key={c} className={s.chip}>{c}</span>)}
          </div>
          <p className={s.why}>{result.bestWhy}</p>
        </section>

        {result.alsoGood.length > 0 && (
          <section className={s.block}>
            <h2 className={s.blockTitle}>Also good</h2>
            {result.alsoGood.map((d) => <AlsoRow key={d.name} dish={d} />)}
          </section>
        )}

        {result.heavier.length > 0 && (
          <section className={`${s.block} ${s.heavyBlock}`}>
            <h2 className={s.blockTitle}>Heavier — go easy</h2>
            {result.heavier.map((d) => (
              <div key={d.name} className={s.heavyRow}>
                <span className={s.heavyName}>{d.name}</span>
                <span className={s.heavyReason}>{d.reason}</span>
              </div>
            ))}
          </section>
        )}
      </main>

      <button
        className={s.planFab}
        onClick={() => setMeal(planFullMeal(result))}
      >
        Plan a full meal
      </button>

      {meal && (
        <div className={s.sheetWrap} role="dialog" aria-label="Plan a full meal">
          <div className={s.sheetScrim} onClick={() => setMeal(null)} />
          <div className={s.sheet}>
            <div className={s.sheetHead}>
              <h2 className={s.sheetTitle}>A full meal</h2>
              <button className={s.sheetClose} onClick={() => setMeal(null)} aria-label="Close">
                <CloseIcon size={18} />
              </button>
            </div>
            <Course label="Starter" dish={meal.starter} />
            <Course label="Main" dish={meal.main} />
            <Course label="Dessert" dish={meal.dessert} />
          </div>
        </div>
      )}
    </div>
  );
}

function AlsoRow({ dish }: { dish: RankedDish }) {
  return (
    <div className={s.alsoRow}>
      <div>
        <span className={s.alsoName}>{dish.name}</span>
        <span className={s.alsoReason}>{dish.reason}</span>
      </div>
      <CheckIcon size={20} />
    </div>
  );
}

function Course({ label, dish }: { label: string; dish: RankedDish | null }) {
  return (
    <div className={s.course}>
      <span className={s.courseLabel}>{label}</span>
      <span className={s.courseDish}>{dish ? dish.name : "—"}</span>
    </div>
  );
}
```

- [ ] **Step 4: Write the verdict styles**

```css
/* app/order/order.module.css */
.bar { display: flex; align-items: center; justify-content: space-between; padding: var(--s-md); }
.place { font-family: var(--display); font-weight: 700; }
.end { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--muted); font-weight: 600; font-size: 0.85rem; }

.poster { flex: 1; padding: 0 var(--s-md) var(--s-2xl); display: flex; flex-direction: column; gap: var(--s-md); }

.hero {
  background: var(--coral); color: #fff; border-radius: var(--r-xl); padding: var(--s-lg);
  display: flex; flex-direction: column; gap: var(--s-sm);
  box-shadow: 0 12px 30px -14px rgba(224, 73, 47, 0.7);
  animation: rise 0.25s ease-out;
}
@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.heroEyebrow { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; opacity: 0.9; }
.heroName { font-family: var(--display); font-weight: 800; font-size: 2.1rem; line-height: 1.05; letter-spacing: -0.02em; }
.chips { display: flex; flex-wrap: wrap; gap: var(--s-sm); }
.chip { background: rgba(255,255,255,0.18); border-radius: var(--r-full); padding: 4px var(--s-sm); font-size: 0.78rem; font-weight: 600; }
.why { opacity: 0.95; font-size: 0.92rem; }

.block { background: var(--surface); border: 1px solid var(--hair); border-radius: var(--r-lg); padding: var(--s-md); display: flex; flex-direction: column; gap: var(--s-sm); }
.blockTitle { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: var(--muted); }
.alsoRow { display: flex; align-items: center; justify-content: space-between; gap: var(--s-md); color: var(--green); }
.alsoName { display: block; font-weight: 700; color: var(--ink); }
.alsoReason { display: block; font-size: 0.82rem; color: var(--muted); }

.heavyBlock { background: var(--terra-soft); border-color: transparent; }
.heavyRow { display: flex; flex-direction: column; }
.heavyName { font-weight: 700; color: var(--terra); }
.heavyReason { font-size: 0.82rem; color: var(--muted); }

.planFab {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--s-lg) + env(safe-area-inset-bottom, 0px));
  z-index: 25; background: var(--gold); color: var(--gold-ink); font-weight: 800;
  padding: var(--s-md) var(--s-xl); border: none; border-radius: var(--r-full);
  box-shadow: 0 10px 24px -10px rgba(245, 166, 35, 0.7);
}

.thinking { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-md); color: var(--muted); padding: var(--s-xl); text-align: center; }
.dots { width: 40px; height: 40px; border: 4px solid var(--coral-soft); border-top-color: var(--coral); border-radius: var(--r-full); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.retry { background: var(--gold); color: var(--gold-ink); font-weight: 700; border: none; padding: var(--s-sm) var(--s-lg); border-radius: var(--r-full); }

.sheetWrap { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-end; justify-content: center; }
.sheetScrim { position: absolute; inset: 0; background: rgba(42, 18, 7, 0.45); }
.sheet { position: relative; width: 100%; max-width: var(--app-w); background: var(--surface); border-radius: var(--r-xl) var(--r-xl) 0 0; padding: var(--s-lg); display: flex; flex-direction: column; gap: var(--s-md); animation: rise 0.25s ease-out; }
.sheetHead { display: flex; align-items: center; justify-content: space-between; }
.sheetTitle { font-family: var(--display); font-weight: 800; font-size: 1.4rem; }
.sheetClose { background: none; border: none; color: var(--muted); }
.course { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s-md); border-bottom: 1px solid var(--hair); padding-bottom: var(--s-sm); }
.courseLabel { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: var(--muted); }
.courseDish { font-family: var(--display); font-weight: 700; font-size: 1.05rem; text-align: right; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/order/page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/order/page.tsx app/order/order.module.css app/order/page.test.tsx
git commit -m "feat(ui): verdict poster + plan-a-full-meal sheet + end session"
```

---

## Task 13: Cleanup — delete dead OCR, drop tesseract, full green + build

Now that Scan is wired to `/api/scan`, the tesseract OCR path is fully dead. Delete it, drop the dependency, remove the now-unused v1 store helper, and prove the whole app builds and the suite is green.

**Files:**
- Delete: `lib/ocr.ts`
- Delete: `lib/store.ts` (replaced by `lib/storage` + session-driven `/order`)
- Modify: `package.json` (remove `tesseract.js`)
- Modify: `DESIGN.md` (Decisions Log entry)

- [ ] **Step 1: Confirm nothing imports the dead modules**

Run:
```bash
grep -rn "lib/ocr\|from \"@/lib/store\"\|readMenuImage\|DEMO_INPUT\|tesseract" app components lib --include="*.ts" --include="*.tsx"
```
Expected: **no matches** (Task 10 replaced the only `lib/ocr` user; `/order` no longer uses `lib/store`). If anything prints, fix that reference before deleting.

- [ ] **Step 2: Delete the dead files**

```bash
git rm lib/ocr.ts lib/store.ts
```

- [ ] **Step 3: Remove the tesseract dependency**

Run:
```bash
npm uninstall tesseract.js
```
Expected: `tesseract.js` is gone from `package.json` `dependencies` and `package-lock.json`.

- [ ] **Step 4: Add the Decisions Log entry to `DESIGN.md`**

Append this row to the Decisions Log table at the bottom of `DESIGN.md`:

```markdown
| 2026-06-06 | Plan 2 shipped: v2 UI (Home/Scan/Intent/Verdict/Plan-a-meal), local-first (localStorage), in-app camera → /api/scan, tesseract deleted | Builds the verdict loop on the merged AI pipeline; My Places/Browse/Profile screens are Plan 2B; auth/DB Plan 3. |
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — Plan 1 tests (ranker + AI + routes) **plus** all Plan 2 logic + component tests; the live integration test stays skipped without a key.

- [ ] **Step 6: Production build**

Run: `npm run build`
Expected: a clean Next.js build — `/`, `/scan`, `/intent`, `/order`, `/api/scan`, `/api/rank` all compile with no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(ui): delete tesseract OCR + v1 store, log Plan 2 in DESIGN.md"
```

---

## Verification (end of Plan 2)

- [ ] `npm test` fully green (Plan 1 + all Plan 2 logic + component tests; live integration skipped without a key).
- [ ] `npm run build` succeeds with the four screens + two routes.
- [ ] Manual / `/qa` (real device or `gstack browse`, with `GEMINI_API_KEY` in `.env.local`):
  - Home shows the coral goal card; the Scan FAB pulses.
  - Tapping Scan opens the **in-app** camera (not the OS camera); the coral frame guide shows; entering a place name + capturing a real menu photo reads dishes and lands on `/intent`. *(This camera-capture path is the one not covered by jsdom tests — verify it here.)*
  - Intent: typing "something light" routes to a verdict ranked for fat-loss; Skip uses the universal goal.
  - Verdict renders the coral "Order this" hero, "Also good" green checks, terracotta "Heavier"; **no bottom CTAs**; "Plan a full meal" opens the sheet with a best starter/main/dessert.
  - Close the tab and reopen `/` → the **active session card** is still there ("Dining now"); "Back to your picks" reloads the cached verdict instantly; **End ✕** clears it.
- [ ] `/design-review` confirms the screens match `DESIGN.md` (Bricolage display, Sunset Coral, scan-reticle, line icons, no emoji in chrome).

## What Plan 2 does NOT cover (handed to later plans)
- **Plan 2B:** My Places / Saved / Browse list / Restaurant detail / Profile screens (the storage layer they need ships here).
- **Plan 3:** Supabase auth + DB + cross-device session sync (swap `lib/storage` bodies; signatures stay).
- **v1.1:** open-ended "Ask YoBite" menu chatbot; LLM-enhanced intent; video frame-sampling scan.
- A formal vision-accuracy eval harness (spec §6b / T10) — captured in `TODOS.md`, formalized in v1.1.

---

## Implementation Tasks (from eng-review findings)
Synthesized from this review. Each derives from a specific finding. These are baked into the amendments above; this is the build checklist.

- [ ] **T1 (P1, human: ~1.5h / CC: ~10min)** — scan — Harden scan: downscale to 1600px + 20s timeout + 1 retry
  - Surfaced by: Architecture Issue 1 — `postScan` no timeout/retry; `capture()` no downscale (spec §6a/T3)
  - Files: `lib/scan/postScan.ts`, `app/scan/page.tsx` · Verify: `npx vitest run lib/scan/postScan.test.ts`
- [ ] **T2 (P1, human: ~30min / CC: ~5min)** — verdict — Invalidate `session.verdict` when goal/ateToday changes
  - Surfaced by: Architecture Issue 2 — intent commit never clears the cached verdict → stale pick
  - Files: `app/intent/page.tsx`, `app/order/page.tsx` · Verify: intent test asserts `verdict` undefined
- [ ] **T3 (P2, human: ~45min / CC: ~10min)** — voice — Extract `useVoiceInput` hook shared by Scan + Intent
  - Surfaced by: Code Quality Issue 3 — duplicated `listenOnce` wiring in two screens
  - Files: `lib/useVoiceInput.ts`, `app/scan/page.tsx`, `app/intent/page.tsx` · Verify: `npx vitest run lib/useVoiceInput.test.tsx`
- [ ] **T4 (P2, human: ~1h / CC: ~10min)** — tests — Add Order error/cache/meal-sheet tests + Home revisit test
  - Surfaced by: Test Issue 4 — verdict screen happy-path only
  - Files: `app/order/page.test.tsx`, `app/page.test.tsx` · Verify: `npm test`
- [ ] **T5 (P1, human: ~2h / CC: ~15min)** — scan — Multi-snap capture: accumulate dishes across pages, finish on Done
  - Surfaced by: Outside voice P2-1 — single still cannot read 4-5 page menus (spec §4.2)
  - Files: `app/scan/page.tsx` · Verify: type-path accumulation test + QA on a real multi-page menu
- [ ] **T6 (P2, human: ~45min / CC: ~10min)** — ui — Mounted gate on Home/Intent/Order to kill first-paint flash
  - Surfaced by: Outside voice P2-3 — flash of default/redirect content vs the calm north star
  - Files: `app/page.tsx`, `app/intent/page.tsx`, `app/order/page.tsx` · Verify: `/design-review` + manual reload
- [ ] **T7 (P2, human: ~20min / CC: ~5min)** — routing — Deck placeholder routes `/browse` `/saved` `/profile` (no 404)
  - Surfaced by: Outside voice P3-3 — deck tabs link to non-existent Plan 2B routes
  - Files: `app/browse/page.tsx`, `app/saved/page.tsx`, `app/profile/page.tsx` · Verify: tap each tab, no 404
- [ ] **T8 (P2, human: ~30min / CC: ~5min)** — tests — Test hygiene: `unstubAllGlobals`, hook `onEnd`, camera-cleanup test
  - Surfaced by: Outside voice P1-2/P1-3/P1-1 — leaky global stubs + untested lifecycle
  - Files: `app/order/page.test.tsx`, `lib/useVoiceInput.test.tsx`, `app/scan/page.test.tsx` · Verify: `npm test` stable across runs

---

## Approved Mockups

Visual direction is locked; reuse the brainstorm-approved mockups as the build reference (no new mockups generated this review).

| Screen/Section | Mockup Path | Direction |
|----------------|-------------|-----------|
| All screens (board) | `docs/design/01-all-screens.png` | Full app board — Sunset Coral / Bricolage |
| Home · Scan · Verdict | `docs/design/02-home-scan-verdict.png` | The three core screens, unified |
| Intent · Chat · Session | `docs/design/03-intent-chat-session.png` | Per-meal intent + active session (chat = v1.1) |
| Browse | `docs/design/04-browse.png` | My Places cards (Plan 2B) + scan-reticle icon |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | (Plan-1 era) scope reduced to C; My Places, full-meal-planner-in-v1, chat→v1.1 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 7 issues, 0 critical gaps — all accepted & folded into the plan |
| Outside Voice | `/plan-eng-review` (Claude subagent) | Independent 2nd opinion | 1 | issues_found | 3 substantive (multi-page scan, first-paint flash, dead deck tabs) + 3 test-hygiene — all accepted |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | 7.5→9/10; 3 decisions (AA contrast fix, signature reveal, first-run empty Home); 1 TODO (web layout) |

- **CROSS-MODEL:** No contradictions — the eng outside-voice findings were additive blind spots (multi-page capture, first-paint flash, 404 tabs), not disagreements with the review.
- **Scope:** Step 0 complexity gate tripped (≈25 files); reviewed and accepted as essential UI complexity (user chose "proceed as-is").
- **UNRESOLVED:** none — all decisions answered (Eng Issues 1–4, OV P2-1/P2-3/P3-3, DR-1/2/3, 2 TODOs).
- **VERDICT:** CEO + ENG + DESIGN CLEARED — architecture, code, tests, performance, and design reviewed; 13 fixes folded into the plan (7 eng + 3 hygiene + 3 design). Design completeness 9/10. Ready to implement subagent-driven.
```
