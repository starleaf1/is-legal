/**
 * Maps items through fn with at most `limit` calls in flight, preserving
 * order.
 * @param {T[]} items Inputs.
 * @param {number} limit Maximum concurrent calls.
 * @param {Function} fn Async mapper.
 * @return {Promise<R[]>} Results in input order.
 */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({length: workers}, worker));
  return results;
};

const isRetryable = (error: unknown) => {
  const status = (error as {status?: unknown})?.status;
  if (status === "RESOURCE_EXHAUSTED" || status === "UNAVAILABLE") return true;
  const message = String((error as Error)?.message ?? error);
  return /\b(429|500|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i
    .test(message);
};

/**
 * Retries fn with exponential backoff on rate-limit and transient errors.
 * @param {Function} fn The call to retry.
 * @param {number} attempts Maximum attempts.
 * @return {Promise<T>} fn's result.
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  attempts = 5
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const delay = 1000 * 2 ** (attempt - 1) * (0.75 + Math.random() / 2);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};
