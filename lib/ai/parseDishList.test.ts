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
    expect(parseDishList(undefined)).toEqual([]);
  });
});
