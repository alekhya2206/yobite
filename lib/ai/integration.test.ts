// lib/ai/integration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readMenuFromEnv } from "./readMenu";

const hasKey = !!process.env.GEMINI_API_KEY || !!process.env.OPENROUTER_API_KEY;

// Only runs with a real key. Put a real menu photo at lib/ai/fixtures/menu.jpg to use.
describe.skipIf(!hasKey)("readMenu integration (live)", () => {
  it("reads dishes from a real menu image", async () => {
    const img = readFileSync(join(__dirname, "fixtures", "menu.jpg")).toString("base64");
    const dishes = await readMenuFromEnv()(img, "image/jpeg");
    expect(dishes.length).toBeGreaterThan(0);
  }, 30_000);
});
