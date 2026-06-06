// lib/storage/index.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getProfile, saveProfile, getGoal, saveGoal,
  getSession, saveSession, clearSession, newSession,
  listPlaces, upsertPlace, getPlace,
} from "./index";

beforeEach(() => localStorage.clear());

describe("profile + goal", () => {
  it("returns a balanced default profile when nothing is stored", () => {
    expect(getProfile()).toEqual({ goal: { id: "balanced" }, dietary: [] });
    expect(getGoal()).toEqual({ id: "balanced" });
  });

  it("persists and reloads the universal goal", () => {
    saveGoal({ id: "high-protein" });
    expect(getGoal()).toEqual({ id: "high-protein" });
    expect(getProfile().goal).toEqual({ id: "high-protein" });
  });

  it("persists dietary restrictions without losing the goal", () => {
    saveGoal({ id: "fat-loss" });
    saveProfile({ goal: getGoal(), dietary: ["vegetarian"] });
    expect(getProfile()).toEqual({ goal: { id: "fat-loss" }, dietary: ["vegetarian"] });
  });
});

describe("active session", () => {
  it("is null by default", () => {
    expect(getSession()).toBeNull();
  });

  it("newSession seeds placeName, dishes, the profile goal, and an id", () => {
    saveGoal({ id: "high-protein" });
    const s = newSession("Chili's", ["Grilled Chicken", "Butter Naan"]);
    expect(s.placeName).toBe("Chili's");
    expect(s.dishes).toEqual(["Grilled Chicken", "Butter Naan"]);
    expect(s.goal).toEqual({ id: "high-protein" });
    expect(typeof s.id).toBe("string");
    expect(s.id.length).toBeGreaterThan(0);
  });

  it("saves, reloads, and clears a session (one active at a time)", () => {
    const s = newSession("Chili's", ["Dal Tadka"]);
    saveSession(s);
    expect(getSession()?.placeName).toBe("Chili's");
    // saving a second session replaces the first — only one active
    saveSession(newSession("Punjabi Dhaba", ["Paneer Tikka"]));
    expect(getSession()?.placeName).toBe("Punjabi Dhaba");
    clearSession();
    expect(getSession()).toBeNull();
  });
});

describe("my places", () => {
  it("is empty by default", () => {
    expect(listPlaces()).toEqual([]);
  });

  it("upserts a place and finds it by name (case-insensitive), newest first", () => {
    upsertPlace({ name: "Chili's", dishes: ["A"], lastVisited: 1 });
    upsertPlace({ name: "Punjabi Dhaba", dishes: ["B"], lastVisited: 2 });
    // re-visit updates in place, doesn't duplicate
    upsertPlace({ name: "chili's", dishes: ["A", "C"], lastVisited: 3 });
    const places = listPlaces();
    expect(places).toHaveLength(2);
    expect(places[0].name).toBe("Chili's"); // most recently visited first
    expect(places[0].dishes).toEqual(["A", "C"]);
    expect(getPlace("CHILI'S")?.lastVisited).toBe(3);
    expect(getPlace("unknown")).toBeNull();
  });
});
