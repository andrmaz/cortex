// Re-export Prisma client and types from generated directory
export { PrismaClient, Prisma } from "../generated/prisma/client.js";
export type {
  Organization,
  User,
  Department,
  UserDepartment,
  Source,
  Document,
  Chunk,
  Policy,
  QueryLog,
} from "../generated/prisma/client.js";

// Organization isolation: query-layer enforcement for all Prisma access.
// See `org-scope/` for the scoping engine and `docs/agents/db.md` for usage.
export * from "./org-scope/index.js";
