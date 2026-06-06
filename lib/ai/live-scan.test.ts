// lib/ai/live-scan.test.ts
//
// A LIVE, manual smoke test — NOT part of the normal suite's intent (it hits the
// real Gemini API and costs a free-tier request). It runs the exact production
// pipeline end to end: readMenuFromEnv() reads a real menu photo → dish[], then
// lib/ranker turns that into a verdict. Watch it read → rank in your terminal.
//
// Usage:
//   MENU_IMAGE=/path/to/menu.jpg npx vitest run lib/ai/live-scan.test.ts
//   MENU_IMAGE=./menu.jpg MENU_GOAL="high protein, ate rice at lunch" \
//     npx vitest run lib/ai/live-scan.test.ts
//
// It self-skips (green, no failure) unless BOTH GEMINI_API_KEY (loaded from
// .env.local) and MENU_IMAGE are present — so it never breaks `npm test`.
import { readFileSync, existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { readMenuFromEnv } from "./readMenu";
import { classifyGoal } from "./intent";
import { rank } from "@/lib/ranker";

// vitest does not auto-load .env.local — load it ourselves so the same key the
// dev server uses also drives this test.
function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

const imagePath = process.env.MENU_IMAGE;
const hasKey = !!(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);
const ready = !!imagePath && hasKey;

describe("live menu scan → rank (manual)", () => {
  it.runIf(ready)(
    "reads a real menu photo and produces a verdict",
    async () => {
      const abs = resolve(process.cwd(), imagePath!);
      const mime = MIME[extname(abs).toLowerCase()] ?? "image/jpeg";
      const base64 = readFileSync(abs).toString("base64");

      console.log(`\n📷 Reading ${abs} (${mime}, ${(base64.length / 1.37 / 1024).toFixed(0)} KB)…`);
      const read = readMenuFromEnv();
      const dishes = await read(base64, mime);

      console.log(`\n🍽️  Dishes read (${dishes.length}):`);
      dishes.forEach((d) => console.log(`   • ${d}`));

      const goalText = process.env.MENU_GOAL ?? "";
      const ateToday = process.env.MENU_ATE ?? "";
      const goal = classifyGoal(goalText);
      const result = rank({ menuText: dishes.join("\n"), goal, ateToday });

      console.log(`\n🎯 Goal: ${result.goalLabel}${goalText ? ` (from "${goalText}")` : ""}`);
      if (result.best) {
        console.log(`\n⭐ ORDER THIS: ${result.best.name}`);
        console.log(`   ${result.bestWhy}`);
        console.log(`   chips: ${result.best.chips.join(" · ")}`);
      } else {
        console.log("\n⚠️  No rankable dish found.");
      }
      if (result.alsoGood.length) {
        console.log(`\n✅ Also good:`);
        result.alsoGood.forEach((d) => console.log(`   • ${d.name} — ${d.reason}`));
      }
      if (result.heavier.length) {
        console.log(`\n🟤 Heavier — go easy:`);
        result.heavier.forEach((d) => console.log(`   • ${d.name} — ${d.reason}`));
      }
      console.log("");

      expect(dishes.length).toBeGreaterThan(0);
      expect(result.dishCount).toBeGreaterThan(0);
    },
    60_000,
  );

  it.skipIf(ready)("skipped — set MENU_IMAGE + a key in .env.local to run", () => {
    if (!hasKey) console.log("[live-scan] no GEMINI_API_KEY/OPENROUTER_API_KEY in .env.local");
    if (!imagePath) console.log("[live-scan] no MENU_IMAGE env var set");
    expect(true).toBe(true);
  });
});
