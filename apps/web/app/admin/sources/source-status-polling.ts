export type SourceStatusRefreshResult<T> = { sources: T[] } | { error: string };

export function startSourceStatusPolling<T>(
  refresh: () => Promise<SourceStatusRefreshResult<T>>,
  onSources: (sources: T[]) => void,
  onError: (message: string) => void,
  intervalMs = 5_000,
): () => void {
  let stopped = false;
  let inFlight = false;

  const timer = setInterval(async () => {
    if (stopped || inFlight) {
      return;
    }

    inFlight = true;
    try {
      const result = await refresh();
      if (stopped) {
        return;
      }
      if ("sources" in result) {
        onSources(result.sources);
      } else {
        onError(result.error);
      }
    } catch {
      if (!stopped) {
        onError("Failed to refresh source status.");
      }
    } finally {
      inFlight = false;
    }
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
