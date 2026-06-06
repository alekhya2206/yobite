// lib/ai/withFallback.ts
// Run primary; on any throw, run fallback. If fallback is null, primary errors propagate.
// Logs the primary failure so a degraded path is never silent.
type AsyncFn<A extends unknown[], R> = (...args: A) => Promise<R>;

export function withFallback<A extends unknown[], R>(
  primary: AsyncFn<A, R>,
  fallback: AsyncFn<A, R> | null,
): AsyncFn<A, R> {
  return async (...args: A): Promise<R> => {
    try {
      return await primary(...args);
    } catch (err) {
      if (!fallback) throw err;
      console.warn("[ai] primary provider failed, using fallback:", err);
      return await fallback(...args);
    }
  };
}
