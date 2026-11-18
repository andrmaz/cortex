/** datetime-local yields "YYYY-MM-DDTHH:mm"; the API requires a UTC offset. */
export function toUtcIso(value?: string): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00Z` : value;
}

/** Builds a query string, dropping empty values. */
export function buildAuditLogQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
