import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AdminModule } from "../admin.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-query-logs-integration";
const BASE = "/api/admin/organizations/org-1/query-logs";

class MockGoogleStrategy {
  name = "google";
}

const decision = { allowed: true, trace: [{ rule: "r1", effect: "allow" }] };

function row(
  id: string,
  createdAt: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    userId: "user-1",
    organizationId: "org-1",
    departmentId: "dept-1",
    query: `query ${id}`,
    contextBundle: {
      citations: [
        { chunkId: "c1", documentId: "d1", sourceId: "s1", score: 0.9 },
      ],
    },
    policyDecision: decision,
    response: null,
    latencyMs: 12,
    createdAt: new Date(createdAt),
    user: { email: "alice@acme.com" },
    ...overrides,
  };
}

const store = [
  row("a", "2024-06-01T10:00:00Z"),
  row("b", "2024-06-02T10:00:00Z", {
    userId: "user-2",
    user: { email: "bob@acme.com" },
    departmentId: "dept-2",
  }),
  row("c", "2024-06-03T10:00:00Z", { departmentId: null }),
  row("d", "2024-06-03T10:00:00Z"),
  row("other-org", "2024-06-03T11:00:00Z", { organizationId: "org-2" }),
];

interface FindManyArgs {
  where: {
    organizationId: string;
    userId?: string;
    departmentId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  };
  orderBy: [{ createdAt: "desc" }, { id: "desc" }];
  take: number;
}

// Emulates the Prisma filter/order/take semantics the service relies on.
function fakeFindMany(args: FindManyArgs) {
  const { where } = args;
  return Promise.resolve(
    store
      .filter(
        (r) =>
          r.organizationId === where.organizationId &&
          (!where.userId || r.userId === where.userId) &&
          (!where.departmentId || r.departmentId === where.departmentId) &&
          (!where.createdAt?.gte || r.createdAt >= where.createdAt.gte) &&
          (!where.createdAt?.lte || r.createdAt <= where.createdAt.lte),
      )
      .sort(
        (x, y) =>
          y.createdAt.getTime() - x.createdAt.getTime() ||
          y.id.localeCompare(x.id),
      )
      .slice(0, args.take),
  );
}

const mockPrisma = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  organization: { findUnique: vi.fn() },
  department: { findMany: vi.fn() },
  queryLog: { findMany: vi.fn() },
};

function issueToken(role: string): string {
  return jwt.sign(
    {
      sub: "admin-user",
      email: "admin@example.com",
      organizationId: "org-1",
      role,
    },
    TEST_JWT_SECRET,
    { expiresIn: "1h" },
  );
}

function ids(body: { items: { id: string }[] }): string[] {
  return body.items.map((i) => i.id);
}

describe("Admin Query Logs Integration", () => {
  let app: INestApplication;
  let previousJwtSecret: string | undefined;

  beforeAll(async () => {
    previousJwtSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule, AuthModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousJwtSecret === undefined) {
      delete process.env["JWT_SECRET"];
    } else {
      process.env["JWT_SECRET"] = previousJwtSecret;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.queryLog.findMany.mockImplementation(fakeFindMany);
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "dept-1", name: "Engineering" },
    ]);
  });

  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${issueToken("admin")}`);

  describe("authorization", () => {
    it("returns 401 without a token", async () => {
      await request(app.getHttpServer()).get(BASE).expect(401);
    });

    it("returns 403 for a member", async () => {
      await request(app.getHttpServer())
        .get(BASE)
        .set("Authorization", `Bearer ${issueToken("member")}`)
        .expect(403);
      expect(mockPrisma.queryLog.findMany).not.toHaveBeenCalled();
    });

    it("returns 403 when an admin requests another organization", async () => {
      await get("/api/admin/organizations/org-2/query-logs").expect(403);
      expect(mockPrisma.queryLog.findMany).not.toHaveBeenCalled();
    });

    it("returns 404 when the organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await get(BASE).expect(404);
    });
  });

  describe("GET query-logs", () => {
    it("lists org entries newest first and never leaks other orgs", async () => {
      const res = await get(BASE).expect(200);

      expect(ids(res.body)).toEqual(["d", "c", "b", "a"]);
      expect(res.body.nextCursor).toBeNull();
      expect(mockPrisma.queryLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      );
    });

    it("returns actor, org, department, decision trace and citations", async () => {
      const res = await get(`${BASE}?userId=user-1&departmentId=dept-1`).expect(
        200,
      );

      expect(res.body.items[0]).toEqual({
        id: "d",
        createdAt: "2024-06-03T10:00:00.000Z",
        actor: { userId: "user-1", email: "alice@acme.com" },
        organizationId: "org-1",
        department: { id: "dept-1", name: "Engineering" },
        query: "query d",
        policyDecision: decision,
        citations: [
          { chunkId: "c1", documentId: "d1", sourceId: "s1", score: 0.9 },
        ],
        latencyMs: 12,
      });
    });

    it("filters by time range", async () => {
      const res = await get(
        `${BASE}?from=2024-06-02T00:00:00Z&to=2024-06-02T23:59:59Z`,
      ).expect(200);

      expect(ids(res.body)).toEqual(["b"]);
    });

    it("filters by user", async () => {
      const res = await get(`${BASE}?userId=user-2`).expect(200);

      expect(ids(res.body)).toEqual(["b"]);
      expect(res.body.items[0].actor.email).toBe("bob@acme.com");
    });

    it("filters by department", async () => {
      const res = await get(`${BASE}?departmentId=dept-1`).expect(200);

      expect(ids(res.body)).toEqual(["d", "a"]);
    });

    it("combines filters", async () => {
      const res = await get(
        `${BASE}?userId=user-1&departmentId=dept-1&from=2024-06-02T00:00:00Z`,
      ).expect(200);

      expect(ids(res.body)).toEqual(["d"]);
    });

    it("paginates with limit and cursor", async () => {
      const first = await get(`${BASE}?limit=2`).expect(200);
      expect(ids(first.body)).toEqual(["d", "c"]);
      expect(first.body.nextCursor).toBe("b");

      await get(`${BASE}?limit=2&cursor=b`).expect(200);
      expect(mockPrisma.queryLog.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: { id: "b" }, take: 3 }),
      );
    });

    it.each([
      "from=not-a-date",
      "limit=0",
      "limit=201",
      "from=2024-06-03T00:00:00Z&to=2024-06-01T00:00:00Z",
    ])("returns 400 for invalid query %s", async (qs) => {
      await get(`${BASE}?${qs}`).expect(400);
      expect(mockPrisma.queryLog.findMany).not.toHaveBeenCalled();
    });
  });

  describe("read-only", () => {
    it.each(["post", "put", "patch", "delete"] as const)(
      "exposes no %s route",
      async (method) => {
        await request(app.getHttpServer())
          [method](BASE)
          .set("Authorization", `Bearer ${issueToken("admin")}`)
          .expect(404);
        await request(app.getHttpServer())
          [method](`${BASE}/a`)
          .set("Authorization", `Bearer ${issueToken("admin")}`)
          .expect(404);
      },
    );
  });
});
