import { adminAuthHeaders } from "../_lib/admin-auth";
import { buildAuditLogQuery } from "./audit-log-query";
import type { AuditLogFilterValues, AuditLogPage } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:4000";

export async function fetchAuditLog(
  organizationId: string,
  filters: AuditLogFilterValues,
): Promise<AuditLogPage> {
  const res = await fetch(
    `${API_URL}/api/admin/organizations/${encodeURIComponent(organizationId)}/query-logs${buildAuditLogQuery(filters)}`,
    {
      headers: await adminAuthHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch audit log: ${res.status}`);
  }

  return res.json() as Promise<AuditLogPage>;
}
