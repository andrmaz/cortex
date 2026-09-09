/**
 * Declarative org-scoping strategy per Prisma model.
 *
 * Every model in `schema.prisma` MUST have an entry here — the extension
 * (`extension.ts`) fails closed via `UnknownOrgScopeModelError` for any
 * model that isn't registered, so a forgotten entry blocks queries instead
 * of silently allowing cross-tenant access.
 */
export type OrgScopeConfig =
  /** The model itself IS the tenant boundary (only `Organization`). */
  | { readonly kind: "self" }
  /** The model has an `organizationId` column directly. */
  | { readonly kind: "direct"; readonly field: string }
  /**
   * The model is scoped transitively through a relation. `chain` is the
   * sequence of relation field names ending in the scalar `organizationId`
   * field on the final related model, e.g. `["document", "source",
   * "organizationId"]` for `Chunk`.
   */
  | {
      readonly kind: "relation";
      readonly chain: readonly [string, ...string[]];
      readonly verifyVia: readonly [
        RelationVerification,
        ...RelationVerification[],
      ];
    };

/**
 * Describes how to verify, at create time, that a relation-scoped model's
 * foreign key actually belongs to the caller's organization. Reads/updates/
 * deletes are verified by merging a relation filter into `where`; creates
 * have no `where` to filter, so the referenced parent record is looked up
 * (through the same org-scoped client) instead.
 */
export interface RelationVerification {
  /** Field on `data` holding the foreign key to verify. */
  readonly foreignKeyField: string;
  /** Model name (as it appears in `ORG_SCOPE_CONFIG`) that owns that key. */
  readonly parentModel: string;
}

export const ORG_SCOPE_CONFIG: Readonly<Record<string, OrgScopeConfig>> = {
  Organization: { kind: "self" },
  User: { kind: "direct", field: "organizationId" },
  Department: { kind: "direct", field: "organizationId" },
  Source: { kind: "direct", field: "organizationId" },
  Policy: { kind: "direct", field: "organizationId" },
  UserDepartment: {
    kind: "relation",
    chain: ["user", "organizationId"],
    verifyVia: [
      { foreignKeyField: "userId", parentModel: "User" },
      { foreignKeyField: "departmentId", parentModel: "Department" },
    ],
  },
  Document: {
    kind: "relation",
    chain: ["source", "organizationId"],
    verifyVia: [{ foreignKeyField: "sourceId", parentModel: "Source" }],
  },
  Chunk: {
    kind: "relation",
    chain: ["document", "source", "organizationId"],
    verifyVia: [{ foreignKeyField: "documentId", parentModel: "Document" }],
  },
  QueryLog: {
    kind: "relation",
    chain: ["user", "organizationId"],
    verifyVia: [{ foreignKeyField: "userId", parentModel: "User" }],
  },
};
