export interface WaitForOptions {
  timeoutMs?: number;
  intervalMs?: number;
  description?: string;
}

/**
 * Flake-free condition polling utility.
 * Polls the asynchronous predicate until it returns a truthy value or times out.
 */
export async function waitFor<T>(
  predicate: () => Promise<T | null | undefined | false>,
  options: WaitForOptions = {}
): Promise<T> {
  const { timeoutMs = 5000, intervalMs = 25, description = 'condition' } = options;
  const start = Date.now();

  let lastError: Error | null = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await predicate();
      if (result) {
        return result;
      }
    } catch (err: any) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const elapsed = Date.now() - start;
  const detail = lastError ? ` (Last error: ${lastError.message})` : '';
  throw new Error(`Timeout waiting for ${description} after ${elapsed}ms${detail}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
