import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { fetchOrganizations } from "../organizations/api";
import type { Organization } from "../organizations/types";
import { OrgPicker } from "../_components/OrgPicker";
import { fetchDepartments } from "../departments/api";
import { fetchUsers } from "../users/api";
import { fetchAuditLog } from "./api";
import { buildAuditLogQuery, toUtcIso } from "./audit-log-query";
import { AuditLogFilters } from "./AuditLogFilters";
import { AuditLogTable } from "./AuditLogTable";
import type { AuditLogFilterValues } from "./types";

export const metadata = {
  title: "Audit log â€” Cortex Admin",
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" style={errorBannerStyle}>
      {message}
    </div>
  );
}

async function AuditLogView({
  organizationId,
  filters,
}: {
  organizationId: string;
  filters: AuditLogFilterValues;
}) {
  try {
    const [page, users, departments] = await Promise.all([
      fetchAuditLog(organizationId, filters),
      fetchUsers(organizationId),
      fetchDepartments(organizationId),
    ]);
    const nextHref = page.nextCursor
      ? `/admin/audit-log${buildAuditLogQuery({
          orgId: organizationId,
          from: filters.from,
          to: filters.to,
          userId: filters.userId,
          departmentId: filters.departmentId,
          cursor: page.nextCursor,
        })}`
      : null;

    return (
      <>
        <AuditLogFilters
          organizationId={organizationId}
          users={users}
          departments={departments}
          values={filters}
        />
        <AuditLogTable entries={page.items} />
        {nextHref && (
          <p style={{ marginTop: "16px" }}>
            <Link href={nextHref}>Older entries â†’</Link>
          </p>
        )}
      </>
    );
  } catch (err) {
    return (
      <ErrorBanner
        message={
          err instanceof Error ? err.message : "Failed to load audit log"
        }
      />
    );
  }
}

interface PageProps {
  searchParams: Promise<{
    orgId?: string;
    from?: string;
    to?: string;
    userId?: string;
    departmentId?: string;
    cursor?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const { orgId, from, to, userId, departmentId, cursor } = await searchParams;

  let organizations: Organization[] = [];
  let orgFetchError: string | null = null;
  try {
    organizations = await fetchOrganizations();
  } catch (err) {
    orgFetchError =
      err instanceof Error ? err.message : "Failed to load organizations";
  }

  const filters: AuditLogFilterValues = {
    from: toUtcIso(from),
    to: toUtcIso(to),
    userId,
    departmentId,
    cursor,
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Audit log</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Read-only history of context queries, policy decisions and the chunks
          returned.
        </p>
      </header>

      {orgFetchError ? (
        <ErrorBanner message={orgFetchError} />
      ) : (
        <OrgPicker
          organizations={organizations}
          selectedOrgId={orgId}
          basePath="/admin/audit-log"
        />
      )}

      {orgId ? (
        <Suspense fallback={<p>Loadingâ€¦</p>}>
          <AuditLogView organizationId={orgId} filters={filters} />
        </Suspense>
      ) : (
        <p style={{ color: "#6b7280" }}>
          Select an organization above to view its audit log.
        </p>
      )}
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const headerStyle: CSSProperties = {
  marginBottom: "32px",
  paddingBottom: "20px",
  borderBottom: "1px solid #e2e8f0",
};

const errorBannerStyle: CSSProperties = {
  padding: "12px 16px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "6px",
  color: "#dc2626",
  marginBottom: "24px",
};
