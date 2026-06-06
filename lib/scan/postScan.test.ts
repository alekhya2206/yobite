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

  // Amendment 1 tests — retry behaviour
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

  // Review fix: permanent 4xx errors fail fast (no retry), with consistent copy.
  it("does NOT retry a permanent 4xx and shows the user-facing message", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) }) as unknown as Response);
    await expect(postScan("X", "image/jpeg", fetchFn)).rejects.toThrow(/menu/i);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
