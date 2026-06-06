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
