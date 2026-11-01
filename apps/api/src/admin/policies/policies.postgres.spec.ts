import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { runWithOrgContext, runWithoutOrgScope } from "db";
import { PrismaService } from "../../prisma/prisma.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../../auth/auth.module";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";
import { OrgContextInterceptor } from "../../common/org-context.interceptor";
import { PoliciesController } from "./policies.controller";
import { PolicyService } from "./policy.service";

class MockGoogleStrategy {
  name = "google";
}
const doc = {
  schemaVersion: 1,
  allowedSourceIds: [] as string[],
  rules: [] as unknown[],
};

describe("Admin policy CRUD against PostgreSQL", () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const sourceId = randomUUID();
  const foreignSourceId = randomUUID();
  let departmentId: string;
  let prisma: PrismaService;
  let app: INestApplication;
  let priorSecret: string | undefined;
  const secret = "policy-local-integration-secret";
  const token = (role = "admin", org = organizationId) =>
    jwt.sign(
      {
        sub: userId,
        email: "policy-test@example.test",
        role,
        organizationId: org,
      },
      secret,
      { expiresIn: "1h" },
    );
  const admin = () => request(app.getHttpServer());
  const create = (
    rulesJson: unknown = doc,
    dept = departmentId,
    authorization = token(),
  ) =>
    admin()
      .post("/api/admin/policies")
      .auth(authorization, { type: "bearer" })
      .send({ departmentId: dept, rulesJson });
  const list = () =>
    admin()
      .get("/api/admin/policies")
      .auth(token(), { type: "bearer" })
      .expect(200);
  const scoped = <T>(fn: () => Promise<T>) =>
    runWithOrgContext(organizationId, fn);

  beforeAll(async () => {
    priorSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = secret;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    for (const id of [organizationId, foreignOrganizationId]) {
      await runWithoutOrgScope(() =>
        prisma.organization.create({ data: { id, name: `policy-test-${id}` } }),
      );
    }
    await scoped(async () => {
      await prisma.user.create({
        data: {
          id: userId,
          googleSub: `policy-${userId}`,
          email: `policy-${userId}@example.test`,
          organizationId,
          role: "admin",
        },
      });
      for (const id of [sourceId]) {
        await prisma.source.create({
          data: { id, name: `Source ${id}`, type: "upload", organizationId },
        });
      }
    });
    await runWithOrgContext(foreignOrganizationId, () =>
      prisma.source.create({
        data: {
          id: foreignSourceId,
          name: "Foreign",
          type: "upload",
          organizationId: foreignOrganizationId,
        },
      }),
    );
    const module = await Test.createTestingModule({
      imports: [AuthModule, PrismaModule],
      controllers: [PoliciesController],
      providers: [
        PolicyService,
        { provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .compile();
    app = module.createNestApplication();
    await app.init();
  }, 60000);

  beforeEach(async () => {
    const department = await scoped(() =>
      prisma.department.create({
        data: { name: randomUUID(), organizationId },
      }),
    );
    departmentId = department.id;
    await scoped(async () => {
      await prisma.userDepartment.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
      await prisma.userDepartment.create({
        data: { userId, departmentId, isPrimary: true },
      });
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) {
      await runWithoutOrgScope(() =>
        prisma.organization.deleteMany({
          where: { id: { in: [organizationId, foreignOrganizationId] } },
        }),
      );
      await prisma.onModuleDestroy();
    }
    if (priorSecret === undefined) delete process.env["JWT_SECRET"];
    else process.env["JWT_SECRET"] = priorSecret;
  });

  it("creates scoped inactive versions and supports reading, updating and deleting", async () => {
    const first = await create().expect(201);
    expect(first.body).toMatchObject({
      organizationId,
      departmentId,
      version: 1,
      isActive: false,
      rulesJson: doc,
    });
    await admin()
      .get(`/api/admin/policies/${first.body.id}`)
      .auth(token(), { type: "bearer" })
      .expect(200);
    const updated = { ...doc, allowedSourceIds: [sourceId] };
    await admin()
      .patch(`/api/admin/policies/${first.body.id}`)
      .auth(token(), { type: "bearer" })
      .send({ rulesJson: updated })
      .expect(200);
    expect(
      (await list()).body.find((p: { id: string }) => p.id === first.body.id)
        .rulesJson,
    ).toEqual(updated);
    const second = await create().expect(201);
    expect(second.body.version).toBe(2);
    await admin()
      .delete(`/api/admin/policies/${first.body.id}`)
      .auth(token(), { type: "bearer" })
      .expect(204);
    await admin()
      .get(`/api/admin/policies/${first.body.id}`)
      .auth(token(), { type: "bearer" })
      .expect(404);
  });

  it("rejects malformed JSON/rules and invalid source references without persistence", async () => {
    const before = (await list()).body.length;
    for (const invalid of [
      {},
      {
        ...doc,
        rules: [{ id: "x", effect: "redact", when: { queryContains: "x" } }],
      },
      { ...doc, allowedSourceIds: [foreignSourceId] },
      { ...doc, allowedSourceIds: [randomUUID()] },
    ]) {
      await create(invalid).expect(400);
    }
    await admin()
      .post("/api/admin/policies")
      .auth(token(), { type: "bearer" })
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400);
    expect((await list()).body.length).toBe(before);
  });

  it("rejects member/anonymous access and isolates department, policy and body organization scope", async () => {
    await create(doc, departmentId, token("member")).expect(403);
    await admin().get("/api/admin/policies").expect(401);
    await create(
      doc,
      departmentId,
      token("admin", foreignOrganizationId),
    ).expect(404);
    const policy = await create().expect(201);
    for (const operation of ["get", "patch", "delete"] as const) {
      const req = admin()
        [operation](`/api/admin/policies/${policy.body.id}`)
        .auth(token("admin", foreignOrganizationId), { type: "bearer" });
      await (operation === "patch" ? req.send({ rulesJson: doc }) : req).expect(
        404,
      );
    }
    await admin()
      .post(`/api/admin/policies/${policy.body.id}/activate`)
      .auth(token("admin", foreignOrganizationId), { type: "bearer" })
      .expect(404);
    await admin()
      .post("/api/admin/policies")
      .auth(token(), { type: "bearer" })
      .send({
        organizationId: foreignOrganizationId,
        departmentId,
        rulesJson: doc,
      })
      .expect(400);
  });

  it("atomically switches active versions, serializes concurrent activation/create, and guards active edits", async () => {
    const versions = await Promise.all([create(), create(), create()]);
    expect(versions.map((v) => v.body.version).sort()).toEqual([1, 2, 3]);
    const activations = await Promise.all(
      versions.map((v) =>
        admin()
          .post(`/api/admin/policies/${v.body.id}/activate`)
          .auth(token(), { type: "bearer" }),
      ),
    );
    expect(activations.map((a) => a.status)).toEqual([200, 200, 200]);
    const active = (await list()).body.filter(
      (p: { departmentId: string; isActive: boolean }) =>
        p.departmentId === departmentId && p.isActive,
    );
    expect(active).toHaveLength(1);
    await admin()
      .patch(`/api/admin/policies/${active[0].id}`)
      .auth(token(), { type: "bearer" })
      .send({ rulesJson: doc })
      .expect(409);
    await admin()
      .delete(`/api/admin/policies/${active[0].id}`)
      .auth(token(), { type: "bearer" })
      .expect(409);
    const inactive = versions.find((v) => v.body.id !== active[0].id)!;
    await expect(
      scoped(() =>
        prisma.policy.update({
          where: { id: inactive.body.id },
          data: { isActive: true },
        }),
      ),
    ).rejects.toMatchObject({ code: "P2002" });
    await admin()
      .post(`/api/admin/policies/${active[0].id}/deactivate`)
      .auth(token(), { type: "bearer" })
      .expect(200);
    expect(
      (await list()).body.filter(
        (p: { departmentId: string; isActive: boolean }) =>
          p.departmentId === departmentId && p.isActive,
      ),
    ).toEqual([]);
  });
});
