import { fetchPolicies } from "./api";
import { fetchSources } from "../sources/api";
import { fetchOrganizations } from "../organizations/api";
import { fetchDepartments } from "../departments/api";
import { PolicyEditor, PolicyLifecycle } from "./PolicyEditor";
import styles from "./policies.module.css";

export const metadata = { title: "Policies — Cortex Admin" };

export default async function PoliciesPage() {
  try {
    const [policies, sources, organizations] = await Promise.all([
      fetchPolicies(),
      fetchSources(),
      fetchOrganizations(),
    ]);
    const organization = organizations[0];
    if (!organization) throw new Error("Your Organization is unavailable.");
    const departments = await fetchDepartments(organization.id);
    return (
      <main className={styles.page}>
        <h1>Policies</h1>
        <p>
          Manage Department policy versions. Activation replaces the current
          active version atomically.
        </p>
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
            {!sources.length ? (
              <p>
                No sources yet. <a href="/admin/sources">Register a source</a>{" "}
                to grant retrieval access.
              </p>
            ) : (
              <ul>
                {sources.map((source) => (
                  <li key={source.id}>
                    {source.name}: <code>{source.id}</code>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </section>
        <section>
          <h2>Policy versions</h2>
          {!policies.length ? (
            <p>
              No policy versions. Create an inactive version above, then
              activate it.
            </p>
          ) : (
            policies.map((policy) => (
              <article
                key={`${policy.id}-${policy.updatedAt}`}
                className={styles.version}
              >
                <h3>
                  {departments.find(
                    (department) => department.id === policy.departmentId,
                  )?.name ?? "Department"}{" "}
                  · Version {policy.version}
                </h3>
                <p>
                  <strong>{policy.isActive ? "Active" : "Inactive"}</strong> ·
                  Updated {new Date(policy.updatedAt).toISOString()}
                </p>
                <PolicyLifecycle policy={policy} />
                <details>
                  <summary>
                    {policy.isActive
                      ? "View policy JSON"
                      : "Edit inactive version"}
                  </summary>
                  {policy.isActive ? (
                    <pre className={styles.example}>
                      {JSON.stringify(policy.rulesJson, null, 2)}
                    </pre>
                  ) : (
                    <PolicyEditor policy={policy} departments={departments} />
                  )}
                </details>
              </article>
            ))
          )}
        </section>
      </main>
    );
  } catch (error) {
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
}
