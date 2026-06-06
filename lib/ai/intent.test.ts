// lib/ai/intent.test.ts
import { describe, it, expect } from "vitest";
import { classifyGoal } from "./intent";

describe("classifyGoal", () => {
  it("maps protein language to high-protein", () => {
    expect(classifyGoal("something high protein but not too heavy").id).toBe("high-protein");
  });

  it("maps weight/light/lean language to fat-loss", () => {
    expect(classifyGoal("trying to lose weight, keep it light").id).toBe("fat-loss");
  });

  it("maps balance language to balanced", () => {
    expect(classifyGoal("just something balanced").id).toBe("balanced");
  });

  it("defaults empty/whitespace to balanced", () => {
    expect(classifyGoal("").id).toBe("balanced");
    expect(classifyGoal("   ").id).toBe("balanced");
  });

  it("keeps unrecognized text as a custom goal", () => {
    const g = classifyGoal("low carb vegetarian please");
    expect(g.id).toBe("custom");
    expect(g.custom).toBe("low carb vegetarian please");
  });
});
