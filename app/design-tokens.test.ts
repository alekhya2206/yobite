// app/design-tokens.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const manifest = readFileSync(join(__dirname, "manifest.ts"), "utf8");

describe("globals.css design tokens (DESIGN.md lock)", () => {
  it("defines the Sunset Coral palette", () => {
    expect(css).toContain("--coral: #E0492F");
    expect(css).toContain("--gold: #F5A623");
    expect(css).toContain("--paper: #FFF1E6");
    expect(css).toContain("--ink: #2A1207");
    expect(css).toContain("--terra: #BE5E3D");
    expect(css).toContain("--green: #2F7A57");
  });

  it("wires the Bricolage + DM Sans font vars", () => {
    expect(css).toMatch(/--display:\s*var\(--font-display\)/);
    expect(css).toContain("Bricolage Grotesque");
    expect(css).toMatch(/--body:\s*var\(--font-body\)/);
  });

  it("does NOT contain any retired v1 tokens", () => {
    expect(css).not.toContain("#FAF6EF"); // v1 cream
    expect(css).not.toContain("Fraunces"); // v1 serif
  });
});

describe("manifest.ts PWA colors (DESIGN.md lock)", () => {
  it("uses the v2 peach canvas, not retired v1 cream/green brand", () => {
    expect(manifest).not.toContain("#FAF6EF"); // v1 cream
    expect(manifest).not.toContain("#2F7A57"); // v1 green-as-brand (green is now only a signal)
    expect(manifest).toContain("#FFF1E6"); // v2 peach
  });
});
