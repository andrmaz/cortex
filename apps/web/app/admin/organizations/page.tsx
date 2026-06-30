import { Suspense } from "react";
import { fetchOrganizations } from "./api";
import { OrgTable } from "./OrgTable";
import { CreateOrgForm } from "./OrgForm";
import type { Organization } from "./types";

export const metadata = {
  title: "Organizations — Cortex Admin",
};

async function OrgList() {
  let orgs: Organization[] = [];
  let fetchError: string | null = null;

  try {
    orgs = await fetchOrganizations();
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load organizations";
  }

  if (fetchError) {
    return (
      <div
        role="alert"
        style={{
          padding: "12px 16px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "6px",
          color: "#dc2626",
        }}
      >
        {fetchError}
      </div>
    );
  }

  return <OrgTable orgs={orgs} />;
}

export default function OrganizationsPage() {
  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Organizations</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Tenant boundaries that scope all downstream resources.
        </p>
      </header>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>All organizations</h2>
        <Suspense fallback={<p>Loading…</p>}>
          <OrgList />
        </Suspense>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Create new organization</h2>
        <div style={{ maxWidth: "480px" }}>
          <CreateOrgForm />
        </div>
      </section>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const headerStyle: React.CSSProperties = {
  marginBottom: "32px",
  paddingBottom: "20px",
  borderBottom: "1px solid #e2e8f0",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "40px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#111827",
  marginBottom: "16px",
};
