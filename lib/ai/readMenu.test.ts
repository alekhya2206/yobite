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
