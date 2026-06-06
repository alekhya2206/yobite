// lib/scan/postScan.ts
// Client → /api/scan. Downscale happens in the Scan screen before this call.
// Adds a 20s timeout (AbortController) and a single retry so a slow/stalled
// vision call can't hang the UI forever. Throws a user-facing error so the
// Scan screen can fall back to "type it" (never a silent dead end).
const TIMEOUT_MS = 20_000;
const FAIL_MSG = "Couldn't read the menu. Try a clearer photo, or type it.";

async function attempt(imageBase64: string, mimeType: string, fetchFn: typeof fetch): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(FAIL_MSG);
    const data = (await res.json()) as { dishes?: string[] };
    if (!data.dishes || data.dishes.length === 0) throw new Error(FAIL_MSG);
    return data.dishes;
  } finally {
    clearTimeout(timer);
  }
}

export async function postScan(
  imageBase64: string,
  mimeType: string,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  try {
    return await attempt(imageBase64, mimeType, fetchFn);
  } catch {
    // one retry — transient timeout / blip
    return await attempt(imageBase64, mimeType, fetchFn);
  }
}
