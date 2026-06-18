// app/api/ask/route.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";
import type { RankResult, RankedDish } from "@/lib/ranker/types";

const dish = (name: string, over: Partial<RankedDish> = {}): RankedDish => ({
  name,
  kind: "main",
  score: 50,
  tier: "good",
  chips: [],
  reason: `${name} reason`,
  signals: [],
  profile: { proteinG: 20, calories: 300, refinedCarb: 0, richness: 0, fried: 0, lean: 0, veg: 0, vegetarian: false },
  ...over,
});

const result = (): RankResult => ({
  best: dish("Grilled Chicken Tikka"),
  alsoGood: [],
  heavier: [],
  all: [dish("Grilled Chicken Tikka"), dish("Paneer Tikka", { profile: { proteinG: 20, calories: 300, refinedCarb: 0, richness: 0, fried: 0, lean: 0, veg: 0.5, vegetarian: true } })],
  goalLabel: "High protein",
  bestWhy: "Lean grilled protein",
  ate: { raw: "", hadCarbs: false, hadFried: false, hadRich: false, hadProtein: false, hadSweet: false },
  dishCount: 2,
});

const post = (body: unknown) =>
  POST(new Request("http://test/api/ask", { method: "POST", body: JSON.stringify(body) }));

// No GROQ_API_KEY in the test env → the route falls back to the instant local
// answer (askYoBite), so these assertions are stable without any network.
describe("POST /api/ask", () => {
  it("answers a question grounded in the ranked menu (local fallback, no key)", async () => {
    const res = await post({ question: "any veg options?", result: result() });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.answer).toBe("string");
    expect(data.answer.length).toBeGreaterThan(0);
  });

  it("returns 400 when the question is missing or blank", async () => {
    expect((await post({ result: result() })).status).toBe(400);
    expect((await post({ question: "   ", result: result() })).status).toBe(400);
  });

  it("returns 400 when the ranked result is missing or malformed", async () => {
    expect((await post({ question: "hi" })).status).toBe(400);
    expect((await post({ question: "hi", result: { all: "nope" } })).status).toBe(400);
  });

  it("returns 400 (never 500) when a dish lacks the expected shape", async () => {
    // {all:[{name:"x"}]} passes the array check but the consumers deref d.profile.
    const res = await post({ question: "hi", result: { all: [{ name: "x" }] } });
    expect(res.status).toBe(400);
  });

  it("returns 400 on a non-JSON body", async () => {
    const res = await POST(new Request("http://test/api/ask", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized question or dish list", async () => {
    expect((await post({ question: "x".repeat(2000), result: result() })).status).toBe(400);
    const big = result();
    big.all = Array.from({ length: 300 }, () => dish("Filler"));
    expect((await post({ question: "hi", result: big })).status).toBe(400);
  });
});
