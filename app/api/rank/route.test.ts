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
