export type SourceStatusRefreshResult<T> = { sources: T[] } | { error: string };

export function startSourceStatusPolling<T>(
  refresh: () => Promise<SourceStatusRefreshResult<T>>,
  onSources: (sources: T[]) => void,
  onError: (message: string) => void,
  intervalMs = 5_000,
): () => void {
  let stopped = false;
  let inFlight = false;

  const report = (result: SourceStatusRefreshResult<T>) => {
    if ("sources" in result) {
      onSources(result.sources);
    } else {
      onError(result.error);
    }
  };

  const refreshAndReport = async () => {
    try {
      const result = await refresh();
      if (!stopped) {
        report(result);
      }
    } catch {
      if (!stopped) {
        onError("Failed to refresh source status.");
      }
    }
  };

  const tick = async () => {
    if (stopped || inFlight) {
      return;
    }

    inFlight = true;
    try {
      await refreshAndReport();
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(tick, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
