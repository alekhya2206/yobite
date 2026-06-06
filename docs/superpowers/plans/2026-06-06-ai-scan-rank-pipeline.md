# AI Layer + Scan→Rank Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, tested server pipeline that turns a menu photo into a trusted ranked verdict — `image → dishes (vision LLM with fallback) → rank() → RankResult` — plus free-text goal parsing. No UI, no accounts, no database. This is Plan 1 of the YoBite v2 build (see `docs/superpowers/specs/2026-06-06-yobite-v2-redesign-design.md`).

**Architecture:** A swappable AI provider layer in `lib/ai/`. Two jobs for v1: `readMenu(imageBase64) → string[]` (Gemini Flash primary, OpenRouter Qwen-VL fallback) and `classifyGoal(text) → Goal` (deterministic). All pure parsing/normalization/composition logic is unit-tested with fakes; the network adapters are thin and built so the response-parsing is a pure, tested function while the actual HTTP call is validated by a key-gated integration test. Two Next.js route handlers (`/api/scan`, `/api/rank`) expose the pipeline; `/api/rank` reuses the existing deterministic `lib/ranker` untouched.

**Tech Stack:** Next.js 15 route handlers, TypeScript, Vitest, native `fetch` (no new runtime deps), Gemini + OpenRouter REST APIs.

---

## File structure

- Create `lib/ai/types.ts` — shared types: `ReadMenu` fn type, `ProviderError`.
- Create `lib/ai/normalizeDishes.ts` — pure: clean a raw dish list (trim, drop empties, dedupe, cap).
- Create `lib/ai/parseDishList.ts` — pure: LLM text (JSON array OR bullet/newline list) → `string[]`.
- Create `lib/ai/withFallback.ts` — pure generic: run a primary fn, fall back to a secondary on throw.
- Create `lib/ai/gemini.ts` — Gemini vision adapter (factory takes apiKey + fetch for testability).
- Create `lib/ai/openrouter.ts` — OpenRouter Qwen-VL fallback adapter (same shape).
- Create `lib/ai/readMenu.ts` — compose primary+fallback+normalize; `readMenuFromEnv()` builds the real one.
- Create `lib/ai/intent.ts` — `classifyGoal(text) → Goal` (deterministic keyword classifier).
- Create `app/api/scan/route.ts` — `POST {imageBase64, mimeType?} → {dishes}`.
- Create `app/api/rank/route.ts` — `POST {dishes, goalText?, goalId?, ateToday?} → RankResult`.
- Create `.env.example` — `GEMINI_API_KEY`, `OPENROUTER_API_KEY`.
- Co-locate tests as `lib/ai/*.test.ts` and `app/api/*/route.test.ts` (matches existing `lib/ranker/ranker.test.ts` convention).

---

## Task 1: normalizeDishes (pure)

**Files:**
- Create: `lib/ai/normalizeDishes.ts`
- Test: `lib/ai/normalizeDishes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/normalizeDishes.test.ts
import { describe, it, expect } from "vitest";
import { normalizeDishes } from "./normalizeDishes";

describe("normalizeDishes", () => {
  it("trims whitespace and drops empty/blank entries", () => {
    expect(normalizeDishes(["  Paneer Tikka ", "", "   ", "Dal Makhani"]))
      .toEqual(["Paneer Tikka", "Dal Makhani"]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    expect(normalizeDishes(["Paneer Tikka", "paneer tikka", "PANEER TIKKA"]))
      .toEqual(["Paneer Tikka"]);
  });

  it("caps the list at 60 dishes", () => {
    const many = Array.from({ length: 80 }, (_, i) => `Dish ${i}`);
    expect(normalizeDishes(many)).toHaveLength(60);
  });

  it("returns an empty array for null/garbage input", () => {
    // @ts-expect-error testing runtime guard
    expect(normalizeDishes(null)).toEqual([]);
    // @ts-expect-error testing runtime guard
    expect(normalizeDishes("not an array")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/normalizeDishes.test.ts`
Expected: FAIL — "Cannot find module './normalizeDishes'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/normalizeDishes.ts
// Clean a raw dish list from any source into something safe to rank:
// trim, drop blanks, dedupe case-insensitively (keep first), cap length.
const MAX_DISHES = 60;

export function normalizeDishes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_DISHES) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/normalizeDishes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/normalizeDishes.ts lib/ai/normalizeDishes.test.ts
git commit -m "feat(ai): normalizeDishes pure helper"
```

---

## Task 2: parseDishList (pure)

Turns whatever text an LLM returns — a JSON array, or a bulleted/numbered/newline list — into a raw `string[]`. Normalization happens separately (Task 1).

**Files:**
- Create: `lib/ai/parseDishList.ts`
- Test: `lib/ai/parseDishList.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/parseDishList.test.ts
import { describe, it, expect } from "vitest";
import { parseDishList } from "./parseDishList";

describe("parseDishList", () => {
  it("parses a clean JSON array", () => {
    expect(parseDishList('["Paneer Tikka", "Dal Makhani"]'))
      .toEqual(["Paneer Tikka", "Dal Makhani"]);
  });

  it("parses a JSON array wrapped in a markdown code fence", () => {
    const text = "```json\n[\"Veg Biryani\", \"Butter Naan\"]\n```";
    expect(parseDishList(text)).toEqual(["Veg Biryani", "Butter Naan"]);
  });

  it("falls back to splitting a bulleted list", () => {
    const text = "- Paneer Tikka\n* Dal Makhani\n1. Veg Biryani";
    expect(parseDishList(text)).toEqual(["Paneer Tikka", "Dal Makhani", "Veg Biryani"]);
  });

  it("returns [] for empty or non-string input", () => {
    expect(parseDishList("")).toEqual([]);
    // @ts-expect-error runtime guard
    expect(parseDishList(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/parseDishList.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/parseDishList.ts
// LLM output → raw dish names. Tries JSON first (incl. ```json fences),
// then falls back to line-by-line parsing of a bulleted/numbered list.
export function parseDishList(text: unknown): string[] {
  if (typeof text !== "string" || !text.trim()) return [];

  const fenced = text.replace(/```(?:json)?/gi, "").trim();

  // Try JSON array first.
  try {
    const parsed = JSON.parse(fenced);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // not JSON — fall through to line parsing
  }

  // Line-by-line: strip leading bullets / numbering.
  return fenced
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/parseDishList.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/parseDishList.ts lib/ai/parseDishList.test.ts
git commit -m "feat(ai): parseDishList handles JSON + bullet lists"
```

---

## Task 3: withFallback (pure generic)

**Files:**
- Create: `lib/ai/types.ts`
- Create: `lib/ai/withFallback.ts`
- Test: `lib/ai/withFallback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/withFallback.test.ts
import { describe, it, expect, vi } from "vitest";
import { withFallback } from "./withFallback";

describe("withFallback", () => {
  it("returns the primary result when primary succeeds", async () => {
    const primary = vi.fn(async () => "primary");
    const fallback = vi.fn(async () => "fallback");
    const run = withFallback(primary, fallback);
    expect(await run("x")).toBe("primary");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses the fallback when primary throws", async () => {
    const primary = vi.fn(async () => { throw new Error("boom"); });
    const fallback = vi.fn(async () => "fallback");
    const run = withFallback(primary, fallback);
    expect(await run("x")).toBe("fallback");
    expect(fallback).toHaveBeenCalledWith("x");
  });

  it("throws the fallback error when both fail", async () => {
    const primary = async () => { throw new Error("primary-fail"); };
    const fallback = async () => { throw new Error("fallback-fail"); };
    const run = withFallback(primary, fallback);
    await expect(run()).rejects.toThrow("fallback-fail");
  });

  it("passes through primary when fallback is null", async () => {
    const run = withFallback(async () => "only", null);
    expect(await run()).toBe("only");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/withFallback.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/types.ts
export type ReadMenu = (imageBase64: string, mimeType?: string) => Promise<string[]>;

export class ProviderError extends Error {
  constructor(public provider: string, message: string) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}
```

```ts
// lib/ai/withFallback.ts
// Run primary; on any throw, run fallback. If fallback is null, primary errors propagate.
// Logs the primary failure so a degraded path is never silent.
type AsyncFn<A extends unknown[], R> = (...args: A) => Promise<R>;

export function withFallback<A extends unknown[], R>(
  primary: AsyncFn<A, R>,
  fallback: AsyncFn<A, R> | null,
): AsyncFn<A, R> {
  return async (...args: A): Promise<R> => {
    try {
      return await primary(...args);
    } catch (err) {
      if (!fallback) throw err;
      console.warn("[ai] primary provider failed, using fallback:", err);
      return await fallback(...args);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/withFallback.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/types.ts lib/ai/withFallback.ts lib/ai/withFallback.test.ts
git commit -m "feat(ai): withFallback + shared AI types"
```

---

## Task 4: Gemini vision adapter

**Files:**
- Create: `lib/ai/gemini.ts`
- Test: `lib/ai/gemini.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/gemini.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeGeminiReadMenu } from "./gemini";

const okResponse = (dishesJson: string) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: dishesJson }] } }],
  }),
});

describe("makeGeminiReadMenu", () => {
  it("posts the image and returns parsed dishes", async () => {
    const fetchFn = vi.fn(async () => okResponse('["Paneer Tikka","Dal Makhani"]') as unknown as Response);
    const read = makeGeminiReadMenu({ apiKey: "k", fetchFn });
    const dishes = await read("BASE64DATA", "image/jpeg");
    expect(dishes).toEqual(["Paneer Tikka", "Dal Makhani"]);
    // sent to the Gemini endpoint with the key
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("key=k");
  });

  it("throws ProviderError on a non-ok HTTP response", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limited" }) as unknown as Response);
    const read = makeGeminiReadMenu({ apiKey: "k", fetchFn });
    await expect(read("X")).rejects.toThrow(/gemini/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/gemini.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/gemini.ts
import { parseDishList } from "./parseDishList";
import { ProviderError, type ReadMenu } from "./types";

const MODEL = "gemini-2.0-flash";
const PROMPT =
  "You are reading a restaurant menu image. Extract ONLY the orderable dish names. " +
  "Ignore prices, section headers, descriptions, and addresses. " +
  'Respond with a JSON array of strings, e.g. ["Paneer Tikka","Dal Makhani"]. No other text.';

interface GeminiDeps {
  apiKey: string;
  fetchFn?: typeof fetch;
}

export function makeGeminiReadMenu({ apiKey, fetchFn = fetch }: GeminiDeps): ReadMenu {
  return async (imageBase64, mimeType = "image/jpeg") => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: PROMPT },
          ],
        },
      ],
    };
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new ProviderError("gemini", `HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseDishList(text);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/gemini.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/gemini.ts lib/ai/gemini.test.ts
git commit -m "feat(ai): Gemini vision readMenu adapter"
```

---

## Task 5: OpenRouter (Qwen-VL) fallback adapter

**Files:**
- Create: `lib/ai/openrouter.ts`
- Test: `lib/ai/openrouter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/openrouter.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeOpenRouterReadMenu } from "./openrouter";

describe("makeOpenRouterReadMenu", () => {
  it("posts the image as a data URL and returns parsed dishes", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '["Veg Biryani"]' } }] }),
    }) as unknown as Response);
    const read = makeOpenRouterReadMenu({ apiKey: "k", fetchFn });
    expect(await read("BASE64", "image/png")).toEqual(["Veg Biryani"]);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(String(init.body)).toContain("data:image/png;base64,BASE64");
  });

  it("throws ProviderError on non-ok response", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500, text: async () => "err" }) as unknown as Response);
    const read = makeOpenRouterReadMenu({ apiKey: "k", fetchFn });
    await expect(read("X")).rejects.toThrow(/openrouter/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/openrouter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/openrouter.ts
import { parseDishList } from "./parseDishList";
import { ProviderError, type ReadMenu } from "./types";

const MODEL = "qwen/qwen-2.5-vl-72b-instruct:free";
const PROMPT =
  "Read this restaurant menu image. Extract ONLY orderable dish names (ignore prices, " +
  'headers, descriptions). Respond with a JSON array of strings and nothing else.';

interface ORDeps {
  apiKey: string;
  fetchFn?: typeof fetch;
}

export function makeOpenRouterReadMenu({ apiKey, fetchFn = fetch }: ORDeps): ReadMenu {
  return async (imageBase64, mimeType = "image/jpeg") => {
    const res = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new ProviderError("openrouter", `HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseDishList(json.choices?.[0]?.message?.content ?? "");
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/openrouter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/openrouter.ts lib/ai/openrouter.test.ts
git commit -m "feat(ai): OpenRouter Qwen-VL fallback adapter"
```

---

## Task 6: readMenu composition (primary + fallback + normalize)

**Files:**
- Create: `lib/ai/readMenu.ts`
- Test: `lib/ai/readMenu.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/readMenu.test.ts
import { describe, it, expect } from "vitest";
import { makeReadMenu } from "./readMenu";

describe("makeReadMenu", () => {
  it("normalizes the primary result (trim + dedupe)", async () => {
    const primary = async () => [" Paneer Tikka ", "paneer tikka", ""];
    const read = makeReadMenu(primary, null);
    expect(await read("img")).toEqual(["Paneer Tikka"]);
  });

  it("uses the fallback when the primary throws, then normalizes", async () => {
    const primary = async () => { throw new Error("down"); };
    const fallback = async () => ["Dal Makhani", "Dal Makhani"];
    const read = makeReadMenu(primary, fallback);
    expect(await read("img")).toEqual(["Dal Makhani"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/readMenu.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/readMenu.ts
import { makeGeminiReadMenu } from "./gemini";
import { makeOpenRouterReadMenu } from "./openrouter";
import { normalizeDishes } from "./normalizeDishes";
import { withFallback } from "./withFallback";
import type { ReadMenu } from "./types";

// Compose: try primary, fall back, then normalize the result.
export function makeReadMenu(primary: ReadMenu, fallback: ReadMenu | null): ReadMenu {
  const run = withFallback(primary, fallback);
  return async (img, mime) => normalizeDishes(await run(img, mime));
}

// Build the real pipeline from environment keys. Gemini primary, OpenRouter fallback.
export function readMenuFromEnv(): ReadMenu {
  const gemini = process.env.GEMINI_API_KEY;
  const openrouter = process.env.OPENROUTER_API_KEY;
  if (!gemini && !openrouter) {
    throw new Error("No AI keys configured: set GEMINI_API_KEY and/or OPENROUTER_API_KEY");
  }
  const primary: ReadMenu | null = gemini ? makeGeminiReadMenu({ apiKey: gemini }) : null;
  const fallback: ReadMenu | null = openrouter ? makeOpenRouterReadMenu({ apiKey: openrouter }) : null;
  // If only one is configured, use it as primary with no fallback.
  const main = primary ?? fallback!;
  const back = primary ? fallback : null;
  return makeReadMenu(main, back);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/readMenu.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/readMenu.ts lib/ai/readMenu.test.ts
git commit -m "feat(ai): compose readMenu with fallback + normalize"
```

---

## Task 7: classifyGoal (free-text intent → Goal)

Deterministic keyword classifier. Free + instant + testable; the LLM-enhanced version is deferred to a later plan (noted in the spec). Maps free text to a `Goal` from `lib/ranker/types`.

**Files:**
- Create: `lib/ai/intent.ts`
- Test: `lib/ai/intent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/intent.test.ts
import { describe, it, expect } from "vitest";
import { classifyGoal } from "./intent";

describe("classifyGoal", () => {
  it("maps protein language to high-protein", () => {
    expect(classifyGoal("something high protein but not too heavy").id).toBe("high-protein");
  });

  it("maps weight/light/lean language to fat-loss", () => {
    expect(classifyGoal("trying to lose weight, keep it light").id).toBe("fat-loss");
  });

  it("maps balance language to balanced", () => {
    expect(classifyGoal("just something balanced").id).toBe("balanced");
  });

  it("defaults empty/whitespace to balanced", () => {
    expect(classifyGoal("").id).toBe("balanced");
    expect(classifyGoal("   ").id).toBe("balanced");
  });

  it("keeps unrecognized text as a custom goal", () => {
    const g = classifyGoal("low carb vegetarian please");
    expect(g.id).toBe("custom");
    expect(g.custom).toBe("low carb vegetarian please");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/intent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/intent.ts
import type { Goal } from "@/lib/ranker/types";

// Deterministic free-text → Goal. Order matters: protein > fat-loss > balanced.
// Unrecognized but non-empty text becomes a custom goal (the ranker handles custom text).
export function classifyGoal(text: string): Goal {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return { id: "balanced" };

  if (/\bprotein\b|muscle|gain|bulk/.test(t)) return { id: "high-protein" };
  if (/lose|weight|light|lean|cut|fat[- ]?loss|low[- ]?cal|diet/.test(t)) return { id: "fat-loss" };
  if (/balanc|normal|regular|whatever|moderate/.test(t)) return { id: "balanced" };

  return { id: "custom", custom: text.trim() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/intent.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/intent.ts lib/ai/intent.test.ts
git commit -m "feat(ai): deterministic classifyGoal intent parser"
```

---

## Task 7b: Widen the Vitest include to cover route tests

The current `vitest.config.ts` only globs `lib/**/*.test.ts`, so `app/` route tests would be silently skipped by `npm test`. Fix it before adding route tests, and add the `@/` path alias so route imports resolve under Vitest.

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Update the config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
```

- [ ] **Step 2: Verify existing tests still pass (alias + include didn't break anything)**

Run: `npm test`
Expected: PASS — the original 28 ranker tests + the AI unit tests from Tasks 1–7 all green.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: vitest include app/ routes + @/ alias"
```

---

## Task 8: /api/scan route

**Files:**
- Create: `app/api/scan/route.ts`
- Test: `app/api/scan/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/scan/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI layer so the route test never hits the network.
vi.mock("@/lib/ai/readMenu", () => ({
  readMenuFromEnv: () => async () => ["Paneer Tikka", "Dal Makhani"],
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://test/api/scan", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/scan", () => {
  it("returns dishes for a valid image", async () => {
    const res = await post({ imageBase64: "BASE64", mimeType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dishes: ["Paneer Tikka", "Dal Makhani"] });
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/scan/route.test.ts`
Expected: FAIL — "Cannot find module './route'".

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/scan/route.ts
import { readMenuFromEnv } from "@/lib/ai/readMenu";

export async function POST(req: Request): Promise<Response> {
  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
    return Response.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  try {
    const read = readMenuFromEnv();
    const dishes = await read(body.imageBase64, body.mimeType);
    return Response.json({ dishes });
  } catch (err) {
    console.error("[api/scan] read failed:", err);
    return Response.json(
      { error: "Could not read the menu. Try a clearer photo, or type it." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/scan/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/scan/route.ts app/api/scan/route.test.ts
git commit -m "feat(api): /api/scan image -> dishes"
```

---

## Task 9: /api/rank route

**Files:**
- Create: `app/api/rank/route.ts`
- Test: `app/api/rank/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/rank/route.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://test/api/rank", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/rank", () => {
  it("ranks dishes and returns a best pick for a high-protein goal", async () => {
    const res = await post({
      dishes: ["Grilled Chicken Tikka", "Butter Chicken", "Veg Biryani", "Dal Tadka"],
      goalText: "high protein",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.best).not.toBeNull();
    expect(data.goalLabel).toBe("High protein");
    expect(typeof data.bestWhy).toBe("string");
  });

  it("returns 400 when dishes are missing or empty", async () => {
    expect((await post({ goalText: "x" })).status).toBe(400);
    expect((await post({ dishes: [] })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/rank/route.test.ts`
Expected: FAIL — "Cannot find module './route'".

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/rank/route.ts
import { rank } from "@/lib/ranker";
import { classifyGoal } from "@/lib/ai/intent";
import type { Goal, GoalId } from "@/lib/ranker/types";

export async function POST(req: Request): Promise<Response> {
  let body: { dishes?: unknown; goalText?: string; goalId?: GoalId; ateToday?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.dishes) || body.dishes.length === 0) {
    return Response.json({ error: "dishes[] is required" }, { status: 400 });
  }

  // A per-meal goalId (from the user's saved goal) wins; otherwise parse free text;
  // empty/skip falls back to balanced (handled inside classifyGoal).
  const goal: Goal = body.goalId ? { id: body.goalId } : classifyGoal(body.goalText ?? "");

  const result = rank({
    menuText: (body.dishes as string[]).join("\n"),
    goal,
    ateToday: body.ateToday,
  });
  return Response.json(result);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/rank/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/rank/route.ts app/api/rank/route.test.ts
git commit -m "feat(api): /api/rank dishes -> verdict via lib/ranker"
```

---

## Task 10: Env config + full-suite green + README note

**Files:**
- Create: `.env.example`
- Modify: `README.md` (add an "AI keys" subsection under "Run it")

- [ ] **Step 1: Write `.env.example`**

```bash
# .env.example  (copy to .env.local and fill in — both are free-tier)
# Gemini Flash (primary vision + intent). Get a key: https://aistudio.google.com/apikey
GEMINI_API_KEY=
# OpenRouter (Qwen-VL fallback). Get a key: https://openrouter.ai/keys
OPENROUTER_API_KEY=
```

- [ ] **Step 2: Add the README note**

Add under the "## Run it" section of `README.md`:

```markdown
### AI keys (free tier)

The scan + rank pipeline calls a vision model. Copy `.env.example` to `.env.local` and add
at least one key (both have free tiers, no card):

- `GEMINI_API_KEY` — primary (Gemini Flash). https://aistudio.google.com/apikey
- `OPENROUTER_API_KEY` — fallback (Qwen-VL). https://openrouter.ai/keys

Unit tests mock the providers and need no keys. The key-gated integration test
(`lib/ai/integration.test.ts`) runs only when `GEMINI_API_KEY` is set.
```

- [ ] **Step 3: Write the key-gated integration test**

```ts
// lib/ai/integration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readMenuFromEnv } from "./readMenu";

const hasKey = !!process.env.GEMINI_API_KEY || !!process.env.OPENROUTER_API_KEY;

// Only runs with a real key. Put a real menu photo at lib/ai/fixtures/menu.jpg to use.
describe.skipIf(!hasKey)("readMenu integration (live)", () => {
  it("reads dishes from a real menu image", async () => {
    const img = readFileSync(join(__dirname, "fixtures", "menu.jpg")).toString("base64");
    const dishes = await readMenuFromEnv()(img, "image/jpeg");
    expect(dishes.length).toBeGreaterThan(0);
  }, 30_000);
});
```

- [ ] **Step 4: Run the full suite (ranker + new AI layer + routes)**

Run: `npm test`
Expected: PASS — the original 28 ranker tests **plus** the new AI/route tests, with the live integration test reported as skipped (no key in CI).

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md lib/ai/integration.test.ts
git commit -m "chore(ai): env example, README keys note, gated integration test"
```

---

## Verification (end of Plan 1)

- [ ] `npm test` is fully green (28 ranker + AI unit + route tests; integration skipped without key).
- [ ] With a real `GEMINI_API_KEY` in `.env.local`, `npm run dev` and `curl -s localhost:3000/api/scan -X POST -H 'content-type: application/json' -d "{\"imageBase64\":\"<base64 of a menu photo>\"}"` returns a `{dishes:[...]}` list.
- [ ] `curl -s localhost:3000/api/rank -X POST -H 'content-type: application/json' -d '{"dishes":["Grilled Chicken Tikka","Butter Chicken"],"goalText":"high protein"}'` returns a verdict with a non-null `best`.
- [ ] The old tesseract OCR path (`lib/ocr.ts`) is now unused — leave it for Plan 2 to delete when the scan UI is rewired (don't break v1 screens mid-plan).

## What Plan 1 does NOT cover (handed to later plans)
- Any UI / screens / styling (Plan 2).
- Auth, database, sessions, My Places (Plan 3).
- Deleting `lib/ocr.ts` and rewiring `/scan` screen (Plan 2, when the new camera UI lands).
- LLM-enhanced intent parsing + open-ended menu chat + video (Plan 4 / v1.1).
- A formal vision-accuracy eval harness (folded into Plan 2's QA, per spec §6b).
