/**
 * Jest manual mock for the Prisma generated client (`db/client`).
 *
 * Used in all unit and integration tests so that module resolution doesn't
 * attempt to load the ESM-only generated Prisma files.
 */

export const mockPrismaClient = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

export class PrismaClient {
  $connect = mockPrismaClient.$connect;
  $disconnect = mockPrismaClient.$disconnect;
  user = mockPrismaClient.user;
  organization = mockPrismaClient.organization;
}

export const Prisma = {};
