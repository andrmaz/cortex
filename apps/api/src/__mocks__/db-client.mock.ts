/**
 * Jest manual mock for the Prisma generated client (`db/client`).
 *
 * Used in all unit and integration tests so that module resolution doesn't
 * attempt to load the ESM-only generated Prisma files.
 */

export const mockPrismaClient = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn(),
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  department: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  userDepartment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
};

export class PrismaClient {
  $connect = mockPrismaClient.$connect;
  $disconnect = mockPrismaClient.$disconnect;
  $transaction = mockPrismaClient.$transaction;
  user = mockPrismaClient.user;
  organization = mockPrismaClient.organization;
  department = mockPrismaClient.department;
  userDepartment = mockPrismaClient.userDepartment;
}

export const Prisma = {};
