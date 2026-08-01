import { Suspense, type CSSProperties } from "react";
import { fetchOrganizations } from "../organizations/api";
import type { Organization } from "../organizations/types";
import { OrgPicker } from "../_components/OrgPicker";
import { fetchDepartments } from "./api";
import { DeptTable } from "./DeptTable";
import { CreateDeptForm } from "./DeptForm";
import type { Department } from "./types";

export const metadata = {
  title: "Departments — Cortex Admin",
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" style={errorBannerStyle}>
      {message}
    </div>
  );
}

async function DeptList({ organizationId }: { organizationId: string }) {
  let departments: Department[] = [];
  let fetchError: string | null = null;

  try {
    departments = await fetchDepartments(organizationId);
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load departments";
  }

  if (fetchError) {
    return <ErrorBanner message={fetchError} />;
  }

  return <DeptTable departments={departments} />;
}

interface PageProps {
  searchParams: Promise<{ orgId?: string }>;
}

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const { orgId } = await searchParams;

  let organizations: Organization[] = [];
  let orgFetchError: string | null = null;
  try {
    organizations = await fetchOrganizations();
  } catch (err) {
    orgFetchError =
      err instanceof Error ? err.message : "Failed to load organizations";
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Departments</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Policy scopes that group users by function within an organization.
        </p>
      </header>

      {orgFetchError ? (
        <ErrorBanner message={orgFetchError} />
      ) : (
        <OrgPicker
          organizations={organizations}
          selectedOrgId={orgId}
          basePath="/admin/departments"
        />
      )}

      {orgId ? (
        <>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>All departments</h2>
            <Suspense fallback={<p>Loading…</p>}>
              <DeptList organizationId={orgId} />
            </Suspense>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Create new department</h2>
            <CreateDeptForm organizationId={orgId} />
          </section>
        </>
      ) : (
        <p style={{ color: "#6b7280" }}>
          Select an organization above to manage its departments.
        </p>
      )}
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const headerStyle: CSSProperties = {
  marginBottom: "32px",
  paddingBottom: "20px",
  borderBottom: "1px solid #e2e8f0",
};

const sectionStyle: CSSProperties = {
  marginBottom: "40px",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#111827",
  marginBottom: "16px",
};

const errorBannerStyle: CSSProperties = {
  padding: "12px 16px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "6px",
  color: "#dc2626",
  marginBottom: "24px",
};
