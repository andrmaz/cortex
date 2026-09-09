export {
  runWithOrgContext,
  runWithoutOrgScope,
  getOrgContext,
  isUnscopedContext,
} from "./context.js";
export type {
  OrgContext,
  UnscopedContext,
  OrgContextStore,
} from "./context.js";

export {
  MissingOrgContextError,
  OrgScopeViolationError,
  UnknownOrgScopeModelError,
} from "./errors.js";

export { ORG_SCOPE_CONFIG } from "./config.js";
export type { OrgScopeConfig, RelationVerification } from "./config.js";

export { createOrgScopedClient } from "./extension.js";

export { computeScopedArgs, getScopeConfig } from "./scope-args.js";
export type { ScopeArgsInput } from "./scope-args.js";
