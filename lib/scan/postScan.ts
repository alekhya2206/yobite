// lib/scan/postScan.ts
// Client → /api/scan. Downscale happens in the Scan screen before this call.
// Adds a 20s timeout (AbortController) and a single retry for TRANSIENT failures
// (network blip / abort / 5xx) only — permanent failures (4xx, empty read) fail
// fast. Always throws the user-facing FAIL_MSG so the Scan screen shows
// consistent copy (never a raw AbortError). (Copilot / Greptile review.)
const TIMEOUT_MS = 20_000;
const FAIL_MSG = "Couldn't read the menu. Try a clearer photo, or type it.";

class ScanError extends Error {
  constructor(public retryable: boolean) {
    super(FAIL_MSG);
    this.name = "ScanError";
  }
}

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
    if (!res.ok) throw new ScanError(res.status >= 500); // 5xx transient, 4xx permanent
    const data = (await res.json()) as { dishes?: string[] };
    if (!data.dishes || data.dishes.length === 0) throw new ScanError(false); // empty = permanent
    return data.dishes;
  } catch (err) {
    if (err instanceof ScanError) throw err;
    throw new ScanError(true); // network reject / abort / timeout = transient
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
  } catch (err) {
    if (err instanceof ScanError && !err.retryable) throw new Error(FAIL_MSG);
    // one retry for transient failures only
    try {
      return await attempt(imageBase64, mimeType, fetchFn);
    } catch {
      throw new Error(FAIL_MSG);
    }
  }
}
