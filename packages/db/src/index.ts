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
