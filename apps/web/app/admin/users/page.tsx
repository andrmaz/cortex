import { Suspense, type CSSProperties } from "react";
import { fetchOrganizations } from "../organizations/api";
import type { Organization } from "../organizations/types";
import { OrgPicker } from "../_components/OrgPicker";
import { fetchDepartments } from "../departments/api";
import type { Department } from "../departments/types";
import { fetchUsers, fetchUserDepartments } from "./api";
import { UserTable } from "./UserTable";
import { AssignDepartmentsForm } from "./AssignDepartmentsForm";
import type { AdminUser, UserDepartmentAssignment } from "./types";

export const metadata = {
  title: "Users — Cortex Admin",
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" style={errorBannerStyle}>
      {message}
    </div>
  );
}

async function UserList({
  organizationId,
  selectedUserId,
}: {
  organizationId: string;
  selectedUserId?: string;
}) {
  let users: AdminUser[] = [];
  let fetchError: string | null = null;

  try {
    users = await fetchUsers(organizationId);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load users";
  }

  if (fetchError) {
    return <ErrorBanner message={fetchError} />;
  }

  return (
    <UserTable
      users={users}
      organizationId={organizationId}
      selectedUserId={selectedUserId}
    />
  );
}

async function AssignmentPanel({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  let departments: Department[] = [];
  let currentAssignments: UserDepartmentAssignment[] = [];
  let fetchError: string | null = null;

  try {
    const [depts, assignment] = await Promise.all([
      fetchDepartments(organizationId),
      fetchUserDepartments(userId),
    ]);
    departments = depts;
    currentAssignments = assignment.departments;
  } catch (err) {
    fetchError =
      err instanceof Error
        ? err.message
        : "Failed to load department assignment";
  }

  if (fetchError) {
    return <ErrorBanner message={fetchError} />;
  }

  return (
    <AssignDepartmentsForm
      userId={userId}
      departments={departments}
      currentAssignments={currentAssignments}
    />
  );
}

interface PageProps {
  searchParams: Promise<{ orgId?: string; userId?: string }>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  const { orgId, userId } = await searchParams;

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
        <h1 style={{ margin: 0, fontSize: "24px" }}>Users</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Assign users to one or more departments within an organization.
        </p>
      </header>

      {orgFetchError ? (
        <ErrorBanner message={orgFetchError} />
      ) : (
        <OrgPicker
          organizations={organizations}
          selectedOrgId={orgId}
          basePath="/admin/users"
        />
      )}

      {orgId ? (
        <>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>All users</h2>
            <Suspense fallback={<p>Loading…</p>}>
              <UserList organizationId={orgId} selectedUserId={userId} />
            </Suspense>
          </section>

          {userId && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>Department assignment</h2>
              <Suspense fallback={<p>Loading…</p>}>
                <AssignmentPanel organizationId={orgId} userId={userId} />
              </Suspense>
            </section>
          )}
        </>
      ) : (
        <p style={{ color: "#6b7280" }}>
          Select an organization above to manage its users.
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
