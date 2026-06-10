// lib/ai/rankMenu.test.ts
import { describe, it, expect, vi } from "vitest";
import { parseAIRanking, makeGroqRankMenu } from "./rankMenu";

const valid = JSON.stringify({
  goalLabel: "High carb",
  bestWhy: "Whole potato — a better carb than refined noodles.",
  dishes: [
    { name: "Mashed Potatoes", tier: "best", reason: "Whole food, lower GI", chips: ["Whole-food carb"] },
    { name: "Fried Rice", tier: "good", reason: "Refined rice + oil", chips: ["Refined"] },
    { name: "Maggi", tier: "heavier", reason: "Ultra-processed", chips: ["Processed"] },
  ],
});

describe("parseAIRanking", () => {
  it("parses a valid ranking", () => {
    const r = parseAIRanking(valid);
    expect(r.goalLabel).toBe("High carb");
    expect(r.dishes).toHaveLength(3);
    expect(r.dishes[0]).toMatchObject({ name: "Mashed Potatoes", tier: "best" });
  });

  it("tolerates ```json fences", () => {
    expect(parseAIRanking("```json\n" + valid + "\n```").dishes).toHaveLength(3);
  });

  it("coerces an unknown tier to 'heavier' and drops nameless rows", () => {
    const r = parseAIRanking(JSON.stringify({
      goalLabel: "x", bestWhy: "y",
      dishes: [{ name: "A", tier: "weird" }, { tier: "best" }, { name: "B", tier: "good" }],
    }));
    expect(r.dishes.map((d) => d.name)).toEqual(["A", "B"]);
    expect(r.dishes[0].tier).toBe("heavier");
  });

  it("throws on non-JSON or missing dishes so the caller can fall back", () => {
    expect(() => parseAIRanking("sorry I can't")).toThrow();
    expect(() => parseAIRanking('{"goalLabel":"x"}')).toThrow();
  });
});

describe("makeGroqRankMenu", () => {
  it("sends the dishes + mood to Groq and returns the parsed ranking", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: valid } }] }),
    }) as unknown as Response);
    const rank = makeGroqRankMenu({ apiKey: "k", fetchFn });
    const out = await rank(["Mashed Potatoes", "Fried Rice", "Maggi"], "high carb");
    expect(out.dishes[0].name).toBe("Mashed Potatoes");
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.temperature).toBe(0);
    expect(JSON.stringify(body.messages)).toContain("high carb");
    expect(JSON.stringify(body.messages)).toContain("Mashed Potatoes");
  });
});
