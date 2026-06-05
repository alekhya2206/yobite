// Menu parsing: raw pasted/OCR'd text → clean dish-name candidates.
//
// Real menus are messy — prices, section headers, dotted leaders, descriptions,
// portion notes. We strip the noise and keep something a human would point at and
// say "that one."

import { SECTION_WORDS } from "./knowledge";

const SECTION_SET = new Set(SECTION_WORDS.map((w) => w.toLowerCase()));

/** Remove prices, dot leaders, quantities and trailing punctuation from one line. */
function cleanLine(line: string): string {
  let s = line.trim();

  // Strip leading bullets / list markers / numbering ("1.", "-", "•", "*").
  s = s.replace(/^[\s•\-*–—·>»#]+/, "");
  s = s.replace(/^\d{1,2}[.)]\s+/, "");

  // Strip dotted leaders before a price ("Paneer Tikka ........ 280").
  s = s.replace(/[.…]{2,}/g, " ");

  // Strip prices: ₹ / Rs / $ / £ / € amounts, and bare trailing numbers.
  s = s.replace(/(?:₹|rs\.?|inr|usd|\$|£|€)\s?\d[\d,.]*/gi, " ");
  s = s.replace(/\b\d{2,4}\s*\/-/g, " "); // "280/-"
  // Trailing price — but protect numeric dish suffixes (Chicken 65, Chicken 555).
  s = s.replace(/\s(\d{2,4})(?:\.\d{1,2})?\s*$/, (m, num) =>
    num === "65" || num === "555" ? m : " ",
  );
  s = s.replace(/\s\d{2,4}\s*\/\s*\d{2,4}\s*$/, " "); // "180 / 320" half/full

  // Collapse whitespace and trim trailing separators.
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[\s,;:|\-–—]+$/, "").trim();

  return s;
}

/** Is this line a section header rather than a dish? */
function isSectionHeader(clean: string): boolean {
  const lower = clean.toLowerCase().replace(/[^a-z\s&-]/g, "").trim();
  if (!lower) return true;
  if (SECTION_SET.has(lower)) return true;
  // Short ALL-CAPS lines are almost always headers ("STARTERS", "MAIN COURSE").
  const words = clean.split(/\s+/);
  const isAllCaps = /[A-Z]/.test(clean) && clean === clean.toUpperCase();
  if (isAllCaps && words.length <= 3 && clean.length <= 20) return true;
  return false;
}

/** Is this line plausibly a dish name (not junk, not a phone number, etc.)? */
function looksLikeDish(clean: string): boolean {
  if (clean.length < 3 || clean.length > 80) return false;
  // Needs letters.
  if (!/[a-zA-Z]/.test(clean)) return false;
  // Reject lines that are mostly digits (addresses, phone numbers, timings).
  const digits = (clean.match(/\d/g) || []).length;
  if (digits > clean.length * 0.4) return false;
  // Reject obvious non-dish noise.
  if (/@|www\.|http|\.com|gst|timing|open|closed|call us|order online/i.test(clean)) {
    return false;
  }
  return true;
}

/**
 * Parse raw menu text into a de-duplicated list of dish-name candidates.
 * If a dish line carries an inline description (after a dash), we keep the
 * whole thing — the classifier reads descriptions too.
 */
export function parseMenu(menuText: string): string[] {
  if (!menuText) return [];

  // Some menus paste as one big line with commas between dishes. If there are very
  // few newlines but many commas, split on commas too.
  const newlineCount = (menuText.match(/\n/g) || []).length;
  const commaCount = (menuText.match(/,/g) || []).length;
  const splitter =
    newlineCount < 2 && commaCount >= 3 ? /[\n,]+/ : /\n+/;

  const seen = new Set<string>();
  const dishes: string[] = [];

  for (const rawLine of menuText.split(splitter)) {
    const clean = cleanLine(rawLine);
    if (!clean) continue;
    if (isSectionHeader(clean)) continue;
    if (!looksLikeDish(clean)) continue;

    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dishes.push(clean);
  }

  return dishes;
}
