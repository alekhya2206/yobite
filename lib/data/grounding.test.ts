// lib/data/grounding.test.ts
import { describe, it, expect } from "vitest";
import { groundDish } from "./grounding";

describe("groundDish — compositional grounding (no RAG)", () => {
  it("grounds an unlisted compositional dish via its components (the core bug)", () => {
    // "Schezwan Chilli Garlic Noodles" is NOT a verbatim FOOD_REFERENCE row.
    const facts = groundDish("Schezwan Chilli Garlic Noodles");
    expect(facts.length).toBeGreaterThan(0);
    const blob = facts.map((f) => f.note.toLowerCase()).join(" ");
    // should cite refined-flour / oil / high-GI noodle facts, not nothing
    expect(blob).toMatch(/refined|maida|noodle|oil|gi/);
  });

  it("resolves regional/Indo-Chinese synonyms to canonical facts", () => {
    const hakka = groundDish("Veg Hakka Noodles");
    expect(hakka.map((f) => f.note.toLowerCase()).join(" ")).toMatch(/refined|noodle|maida/);

    const panir = groundDish("Panir Tikka"); // common misspelling of paneer
    expect(panir.map((f) => f.note.toLowerCase()).join(" ")).toMatch(/cottage cheese|paneer|protein/);
  });

  it("composes multiple facts for a protein + carb + method dish", () => {
    const facts = groundDish("Grilled Chicken with Brown Rice");
    expect(facts.length).toBeGreaterThanOrEqual(2);
    const matches = facts.map((f) => f.match);
    // distinct components recognized
    expect(new Set(matches).size).toBe(matches.length); // deduped
  });

  it("caps the number of facts so the prompt stays tight", () => {
    const facts = groundDish("Butter Paneer Fried Rice with Cheese Naan and Dal");
    expect(facts.length).toBeLessThanOrEqual(4);
  });

  it("returns no fabricated facts when nothing is recognizable", () => {
    expect(groundDish("Zorblax Surprise")).toEqual([]);
  });

  it("does not ground a standalone number as fried (the '65' token must not over-match)", () => {
    expect(groundDish("Room 65 Special")).toEqual([]);
    expect(groundDish("Aisle 65 Combo")).toEqual([]);
  });

  it("still grounds Chicken 65 as fried via the multiword token", () => {
    const facts = groundDish("Chicken 65");
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.map((f) => f.note.toLowerCase()).join(" ")).toMatch(/fried|oil/);
  });

  it("still resolves exactly-listed dishes (no regression vs lookupFood)", () => {
    const facts = groundDish("Butter Chicken");
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((f) => f.source === "exact")).toBe(true);
    expect(facts.map((f) => f.note.toLowerCase()).join(" ")).toMatch(/cream|butter|protein/);
  });

  it("emits a component fact for a fried method even with no exact carb/protein row", () => {
    const facts = groundDish("Crispy Fried Lotus Stem");
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.map((f) => f.note.toLowerCase()).join(" ")).toMatch(/fried|oil/);
  });
});
