// app/layout.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "layout.tsx"), "utf8");

describe("layout.tsx fonts (DESIGN.md lock)", () => {
  it("loads Bricolage Grotesque as the display font", () => {
    expect(src).toContain("Bricolage_Grotesque");
    expect(src).toContain('variable: "--font-display"');
  });
  it("keeps DM Sans as the body font", () => {
    expect(src).toContain("DM_Sans");
    expect(src).toContain('variable: "--font-body"');
  });
  it("drops the retired Fraunces serif", () => {
    expect(src).not.toContain("Fraunces");
  });
});
