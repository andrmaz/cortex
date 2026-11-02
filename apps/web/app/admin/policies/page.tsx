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

interface FetchResult<T> {
  value: T;
  error: string | null;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" style={errorBannerStyle}>
      {message}
    </div>
  );
}

async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  fallbackMessage: string,
): Promise<FetchResult<T>> {
  try {
    return { value: await fetcher(), error: null };
  } catch (error) {
    return {
      value: fallback,
      error: error instanceof Error ? error.message : fallbackMessage,
    };
  }
}

async function loadPoliciesPageData(orgId?: string, departmentId?: string) {
  const organizations = await fetchWithFallback(
    fetchOrganizations,
    [],
    "Failed to load organizations",
  );
  const departments: FetchResult<Department[]> = orgId
    ? await fetchWithFallback(
        () => fetchDepartments(orgId),
        [],
        "Failed to load departments",
      )
    : { value: [], error: null };

  const selectedDepartment = departments.value.find(
    (department) => department.id === departmentId,
  );
  const policies: FetchResult<PolicyVersion[]> = selectedDepartment
    ? await fetchWithFallback(
        () => fetchPolicies(selectedDepartment.id),
        [],
        "Failed to load policies",
      )
    : { value: [], error: null };

  return {
    orgId,
    organizations: organizations.value,
    organizationError: organizations.error,
    departments: departments.value,
    departmentError: departments.error,
    selectedDepartment,
    policies: policies.value,
    policyError: policies.error,
  };
}

function OrganizationSection({
  organizations,
  organizationError,
  orgId,
}: {
  organizations: Organization[];
  organizationError: string | null;
  orgId?: string;
}) {
  return organizationError ? (
    <ErrorBanner message={organizationError} />
  ) : (
    <OrgPicker
      organizations={organizations}
      selectedOrgId={orgId}
      basePath="/admin/policies"
    />
  );
}

function EmptyDepartmentNotice({ departments }: { departments: Department[] }) {
  if (departments.length > 0) {
    return null;
  }

  return (
    <p style={{ color: "#6b7280" }}>
      Create a department before adding policies.
    </p>
  );
}

function DepartmentSection({
  orgId,
  departments,
  departmentError,
  selectedDepartment,
}: {
  orgId?: string;
  departments: Department[];
  departmentError: string | null;
  selectedDepartment?: Department;
}) {
  if (!orgId) {
    return null;
  }

  if (departmentError) {
    return <ErrorBanner message={departmentError} />;
  }

  return (
    <>
      <DepartmentPicker
        organizationId={orgId}
        departments={departments}
        selectedDepartmentId={selectedDepartment?.id}
      />
      <EmptyDepartmentNotice departments={departments} />
    </>
  );
}

function PolicySections({
  selectedDepartment,
  policies,
  policyError,
}: {
  selectedDepartment?: Department;
  policies: PolicyVersion[];
  policyError: string | null;
}) {
  if (!selectedDepartment) {
    return null;
  }

  return (
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
  );
}

function DepartmentPrompt({
  orgId,
  selectedDepartment,
  departments,
}: {
  orgId?: string;
  selectedDepartment?: Department;
  departments: Department[];
}) {
  if (!orgId || selectedDepartment || departments.length === 0) {
    return null;
  }

  return (
    <p style={{ color: "#6b7280" }}>
      Select a department to review and edit its policies.
    </p>
  );
}

export default async function PoliciesPage({ searchParams }: PageProps) {
  const { orgId, departmentId } = await searchParams;
  const data = await loadPoliciesPageData(orgId, departmentId);

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Policies</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Create department policy versions, review their history, and control
          activation.
        </p>
      </header>

      <OrganizationSection
        organizations={data.organizations}
        organizationError={data.organizationError}
        orgId={data.orgId}
      />
      <DepartmentSection
        orgId={data.orgId}
        departments={data.departments}
        departmentError={data.departmentError}
        selectedDepartment={data.selectedDepartment}
      />
      <PolicySections
        selectedDepartment={data.selectedDepartment}
        policies={data.policies}
        policyError={data.policyError}
      />
      <DepartmentPrompt
        orgId={data.orgId}
        selectedDepartment={data.selectedDepartment}
        departments={data.departments}
      />
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
