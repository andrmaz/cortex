import type { CSSProperties } from "react";
import { OrgPicker } from "../_components/OrgPicker";
import { fetchDepartments } from "../departments/api";
import type { Department } from "../departments/types";
import { fetchOrganizations } from "../organizations/api";
import type { Organization } from "../organizations/types";
import { DepartmentPicker } from "./DepartmentPicker";
import { fetchPolicies } from "./api";
import { PolicyEditor } from "./PolicyEditor";
import { PolicyHistory } from "./PolicyHistory";
import type { PolicyVersion } from "./types";

export const metadata = {
  title: "Policies — Cortex Admin",
};

interface PageProps {
  searchParams: Promise<{ orgId?: string; departmentId?: string }>;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" style={errorBannerStyle}>
      {message}
    </div>
  );
}

export default async function PoliciesPage({ searchParams }: PageProps) {
  const { orgId, departmentId } = await searchParams;

  let organizations: Organization[] = [];
  let organizationError: string | null = null;
  try {
    organizations = await fetchOrganizations();
  } catch (error) {
    organizationError =
      error instanceof Error ? error.message : "Failed to load organizations";
  }

  let departments: Department[] = [];
  let departmentError: string | null = null;
  if (orgId) {
    try {
      departments = await fetchDepartments(orgId);
    } catch (error) {
      departmentError =
        error instanceof Error ? error.message : "Failed to load departments";
    }
  }

  const selectedDepartment = departments.find(
    (department) => department.id === departmentId,
  );
  let policies: PolicyVersion[] = [];
  let policyError: string | null = null;
  if (selectedDepartment) {
    try {
      policies = await fetchPolicies(selectedDepartment.id);
    } catch (error) {
      policyError =
        error instanceof Error ? error.message : "Failed to load policies";
    }
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Policies</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Create department policy versions, review their history, and control
          activation.
        </p>
      </header>

      {organizationError ? (
        <ErrorBanner message={organizationError} />
      ) : (
        <OrgPicker
          organizations={organizations}
          selectedOrgId={orgId}
          basePath="/admin/policies"
        />
      )}

      {orgId &&
        (departmentError ? (
          <ErrorBanner message={departmentError} />
        ) : (
          <DepartmentPicker
            organizationId={orgId}
            departments={departments}
            selectedDepartmentId={selectedDepartment?.id}
          />
        ))}

      {orgId && !departmentError && departments.length === 0 && (
        <p style={{ color: "#6b7280" }}>
          Create a department before adding policies.
        </p>
      )}

      {selectedDepartment && (
        <>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>
              {selectedDepartment.name} policy versions
            </h2>
            {policyError ? (
              <ErrorBanner message={policyError} />
            ) : (
              <PolicyHistory policies={policies} />
            )}
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Create a version</h2>
            <PolicyEditor departmentId={selectedDepartment.id} />
          </section>
        </>
      )}

      {orgId && !selectedDepartment && departments.length > 0 && (
        <p style={{ color: "#6b7280" }}>
          Select a department to review and edit its policies.
        </p>
      )}
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: "1000px",
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
