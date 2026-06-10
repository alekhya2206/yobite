// app/api/rank/route.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://test/api/rank", { method: "POST", body: JSON.stringify(body) }));

// No GROQ_API_KEY in the test env → the route exercises the deterministic fallback path,
// so these assertions are stable without any network. The AI-ranking correctness is
// verified live (gated on the key).
describe("POST /api/rank", () => {
  it("ranks dishes for a mood and returns a best pick + label", async () => {
    const res = await post({
      dishes: ["Grilled Chicken Tikka", "Butter Chicken", "Veg Biryani", "Dal Tadka"],
      mood: "high protein",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.best).not.toBeNull();
    expect(typeof data.goalLabel).toBe("string");
    expect(typeof data.bestWhy).toBe("string");
  });

  it("returns 400 when dishes are missing or empty", async () => {
    expect((await post({ mood: "x" })).status).toBe(400);
    expect((await post({ dishes: [] })).status).toBe(400);
  });

  it("tolerates an empty mood (no preference)", async () => {
    const res = await post({ dishes: ["Grilled Chicken Tikka", "Loaded Nachos"], mood: "" });
    expect(res.status).toBe(200);
    expect((await res.json()).best).not.toBeNull();
  });

  it("tolerates blank/non-string dishes by normalizing them out", async () => {
    const res = await post({ dishes: ["Grilled Chicken Tikka", "", 123], mood: "high protein" });
    expect(res.status).toBe(200);
    expect((await res.json()).best).not.toBeNull();
  });
});
