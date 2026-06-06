// lib/ai/withFallback.test.ts
import { describe, it, expect, vi } from "vitest";
import { withFallback } from "./withFallback";

describe("withFallback", () => {
  it("returns the primary result when primary succeeds", async () => {
    const primary = vi.fn<(arg: string) => Promise<string>>(async () => "primary");
    const fallback = vi.fn<(arg: string) => Promise<string>>(async () => "fallback");
    const run = withFallback(primary, fallback);
    expect(await run("x")).toBe("primary");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses the fallback when primary throws", async () => {
    const primary = vi.fn<(arg: string) => Promise<string>>(async () => { throw new Error("boom"); });
    const fallback = vi.fn<(arg: string) => Promise<string>>(async () => "fallback");
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
