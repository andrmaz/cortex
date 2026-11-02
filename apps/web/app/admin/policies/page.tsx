import { fetchPolicies } from "./api";
import { fetchSources } from "../sources/api";
import { fetchOrganizations } from "../organizations/api";
import { fetchDepartments } from "../departments/api";
import { PolicyEditor, PolicyLifecycle } from "./PolicyEditor";
import type { Policy } from "./types";
import type { Source } from "../sources/types";
import type { Department } from "../departments/types";
import styles from "./policies.module.css";

export const metadata = { title: "Policies — Cortex Admin" };

type PolicyPageData = {
  policies: Policy[];
  sources: Source[];
  departments: Department[];
};

async function loadPolicyPageData(): Promise<PolicyPageData> {
  const [policies, sources, organizations] = await Promise.all([
    fetchPolicies(),
    fetchSources(),
    fetchOrganizations(),
  ]);
  const organization = organizations[0];
  if (!organization) throw new Error("Your Organization is unavailable.");
  const departments = await fetchDepartments(organization.id);
  return { policies, sources, departments };
}

function PolicyExample({ sources }: { sources: Source[] }) {
  return (
    <details>
      <summary>Rule example and available source IDs</summary>
      <pre className={styles.example}>
        {JSON.stringify(
          {
            schemaVersion: 1,
            allowedSourceIds: sources[0] ? [sources[0].id] : [],
            rules: [
              {
                id: "deny-pay",
                when: { queryContains: "salary" },
                effect: "deny",
                reasonCode: "PAY_DENIED",
                reason: "Compensation access is restricted.",
              },
              {
                id: "mask-secret",
                when: { chunkContentContains: "secret" },
                effect: "redact",
                replacement: "[REDACTED]",
              },
            ],
          },
          null,
          2,
        )}
      </pre>
      <PolicySources sources={sources} />
    </details>
  );
}

function PolicySources({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return (
      <p>
        No sources yet. <a href="/admin/sources">Register a source</a> to grant
        retrieval access.
      </p>
    );
  }
  return (
    <ul>
      {sources.map((source) => (
        <li key={source.id}>
          {source.name}: <code>{source.id}</code>
        </li>
      ))}
    </ul>
  );
}

function PolicyCreation({
  departments,
  sources,
}: {
  departments: Department[];
  sources: Source[];
}) {
  return (
    <section>
      <h2>Create a version</h2>
      {!departments.length ? (
        <p>
          Create a <a href="/admin/departments">Department</a> before
          configuring a Policy.
        </p>
      ) : (
        <PolicyEditor departments={departments} />
      )}
      <PolicyExample sources={sources} />
    </section>
  );
}

function PolicyVersion({
  policy,
  departments,
}: {
  policy: Policy;
  departments: Department[];
}) {
  return (
    <article className={styles.version}>
      <PolicyVersionHeading policy={policy} departments={departments} />
      <PolicyVersionStatus policy={policy} />
      <PolicyLifecycle policy={policy} />
      <PolicyVersionDetails policy={policy} departments={departments} />
    </article>
  );
}

function PolicyVersionHeading({
  policy,
  departments,
}: {
  policy: Policy;
  departments: Department[];
}) {
  const departmentName =
    departments.find((department) => department.id === policy.departmentId)
      ?.name ?? "Department";
  return (
    <h3>
      {departmentName} · Version {policy.version}
    </h3>
  );
}

function PolicyVersionStatus({ policy }: { policy: Policy }) {
  return (
    <p>
      <strong>{policy.isActive ? "Active" : "Inactive"}</strong> · Updated{" "}
      {new Date(policy.updatedAt).toISOString()}
    </p>
  );
}

function PolicyVersionDetails({
  policy,
  departments,
}: {
  policy: Policy;
  departments: Department[];
}) {
  return (
    <details>
      <summary>
        {policy.isActive ? "View policy JSON" : "Edit inactive version"}
      </summary>
      {policy.isActive ? (
        <pre className={styles.example}>
          {JSON.stringify(policy.rulesJson, null, 2)}
        </pre>
      ) : (
        <PolicyEditor policy={policy} departments={departments} />
      )}
    </details>
  );
}

function PolicyVersions({
  policies,
  departments,
}: {
  policies: Policy[];
  departments: Department[];
}) {
  return (
    <section>
      <h2>Policy versions</h2>
      {!policies.length ? (
        <p>
          No policy versions. Create an inactive version above, then activate
          it.
        </p>
      ) : (
        policies.map((policy) => (
          <PolicyVersion
            key={policy.id}
            policy={policy}
            departments={departments}
          />
        ))
      )}
    </section>
  );
}

function PolicyPageContent({ policies, sources, departments }: PolicyPageData) {
  return (
    <main className={styles.page}>
      <h1>Policies</h1>
      <p>
        Manage Department policy versions. Activation replaces the current
        active version atomically.
      </p>
      <PolicyCreation departments={departments} sources={sources} />
      <PolicyVersions policies={policies} departments={departments} />
    </main>
  );
}

function PolicyPageError({ error }: { error: unknown }) {
  return (
    <main className={styles.page}>
      <h1>Policies</h1>
      <p role="alert" className={styles.error}>
        {error instanceof Error ? error.message : "Unable to load policies."}
      </p>
      <a href="/admin/policies">Try again</a>
    </main>
  );
}

export default async function PoliciesPage() {
  try {
    return <PolicyPageContent {...await loadPolicyPageData()} />;
  } catch (error) {
    return <PolicyPageError error={error} />;
  }
}
