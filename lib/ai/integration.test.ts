// lib/ai/integration.test.ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readMenuFromEnv } from "./readMenu";

// ESM-safe __dirname (Vitest runs tests as ES modules).
const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "fixtures", "menu.jpg");

// Runs ONLY with a real key AND a sample menu photo present — otherwise it skips
// cleanly (never crashes on a missing fixture).
const hasKey = !!process.env.GEMINI_API_KEY || !!process.env.OPENROUTER_API_KEY;
const canRun = hasKey && existsSync(fixture);

describe.skipIf(!canRun)("readMenu integration (live)", () => {
  it("reads dishes from a real menu image", async () => {
    const img = readFileSync(fixture).toString("base64");
    const dishes = await readMenuFromEnv()(img, "image/jpeg");
    expect(dishes.length).toBeGreaterThan(0);
  }, 30_000);
});
