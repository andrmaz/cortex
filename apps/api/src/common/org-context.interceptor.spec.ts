import type { CallHandler, ExecutionContext } from "@nestjs/common";
import {
  CanActivate,
  Controller,
  Get,
  INestApplication,
  Injectable,
  Module,
  UseGuards,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { of } from "rxjs";
import { getOrgContext } from "db";
import { OrgContextInterceptor } from "./org-context.interceptor";

interface RequestWithUser {
  user?: { organizationId: string };
  headers: Record<string, string | undefined>;
}

/**
 * Stands in for `JwtAuthGuard`: reads a test-only header instead of
 * validating a real JWT, so this suite can exercise `OrgContextInterceptor`
 * in isolation without pulling in the full auth stack.
 */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const organizationId = request.headers["x-test-org"];
    if (organizationId) {
      request.user = { organizationId };
    }
    return true;
  }
}

function readOrgId(): string | null {
  const context = getOrgContext();
  if (context && "organizationId" in context) {
    return context.organizationId;
  }
  return null;
}

/**
 * A "lazy thenable" that, like Prisma's client methods, registers its
 * `.then()` reaction only when awaited — unlike a plain `Promise`, which
 * begins settling immediately on construction. Used below to prove the
 * interceptor's context survives a realistic multi-hop async chain, not
 * just a synchronous handler.
 */
function fakeDbCall<T>(resolve: () => T): PromiseLike<T> {
  return {
    then<TResult1, TResult2>(
      onFulfilled: (value: T) => TResult1 | PromiseLike<TResult1>,
    ): PromiseLike<TResult1 | TResult2> {
      return new Promise((res) => {
        queueMicrotask(() => res(onFulfilled(resolve())));
      });
    },
  };
}

async function fakeServiceLayer(): Promise<string | null> {
  // Mirrors a real controller -> service -> PrismaService chain: several
  // `await` hops, the last of which is a Prisma-like lazy thenable.
  await Promise.resolve();
  const nested = await (async () => fakeDbCall(() => readOrgId()))();
  return nested;
}

@Controller()
class ProbeController {
  @Get("authenticated")
  @UseGuards(FakeAuthGuard)
  authenticated(): { organizationId: string | null } {
    return { organizationId: readOrgId() };
  }

  @Get("public")
  public(): { organizationId: string | null } {
    return { organizationId: readOrgId() };
  }

  @Get("authenticated-async-chain")
  @UseGuards(FakeAuthGuard)
  async authenticatedAsyncChain(): Promise<{ organizationId: string | null }> {
    const organizationId = await fakeServiceLayer();
    return { organizationId };
  }

  @Get("authenticated-throws")
  @UseGuards(FakeAuthGuard)
  authenticatedThrows(): never {
    // Simulates a synchronous throw inside the org-context window, which
    // `runWithOrgContext` (now async) turns into a rejected promise rather
    // than a synchronous exception — the interceptor must forward that
    // rejection to the response instead of leaving it unhandled.
    throw new Error("synchronous failure inside org context");
  }
}

@Module({
  controllers: [ProbeController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor }],
})
class ProbeModule {}

describe("OrgContextInterceptor", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("binds the authenticated user's organizationId as the active org context", async () => {
    const res = await request(app.getHttpServer())
      .get("/authenticated")
      .set("x-test-org", "org-1")
      .expect(200);

    expect(res.body).toEqual({ organizationId: "org-1" });
  });

  it("leaves no org context active for unauthenticated requests", async () => {
    const res = await request(app.getHttpServer())
      .get("/authenticated")
      .expect(200);

    expect(res.body).toEqual({ organizationId: null });
  });

  it("leaves no org context active for public routes with no guard at all", async () => {
    const res = await request(app.getHttpServer()).get("/public").expect(200);

    expect(res.body).toEqual({ organizationId: null });
  });

  it("clears the org context once the request completes (no leakage between requests)", async () => {
    await request(app.getHttpServer())
      .get("/authenticated")
      .set("x-test-org", "org-1")
      .expect(200);

    const res = await request(app.getHttpServer()).get("/public").expect(200);

    expect(res.body).toEqual({ organizationId: null });
  });

  it("survives a realistic multi-hop async chain (controller -> service -> lazy Prisma-like call)", async () => {
    const res = await request(app.getHttpServer())
      .get("/authenticated-async-chain")
      .set("x-test-org", "org-1")
      .expect(200);

    expect(res.body).toEqual({ organizationId: "org-1" });
  });

  it("keeps concurrent requests for different organizations fully isolated", async () => {
    const [resA, resB, resC] = await Promise.all([
      request(app.getHttpServer())
        .get("/authenticated")
        .set("x-test-org", "org-a"),
      request(app.getHttpServer())
        .get("/authenticated")
        .set("x-test-org", "org-b"),
      request(app.getHttpServer())
        .get("/authenticated")
        .set("x-test-org", "org-c"),
    ]);

    expect(resA.body).toEqual({ organizationId: "org-a" });
    expect(resB.body).toEqual({ organizationId: "org-b" });
    expect(resC.body).toEqual({ organizationId: "org-c" });
  });

  it("forwards a synchronous throw inside the org context as a normal error response, not an unhandled rejection", async () => {
    await request(app.getHttpServer())
      .get("/authenticated-throws")
      .set("x-test-org", "org-1")
      .expect(500);
  });

  it("keeps concurrent multi-hop async chains isolated across organizations", async () => {
    const [resX, resY] = await Promise.all([
      request(app.getHttpServer())
        .get("/authenticated-async-chain")
        .set("x-test-org", "org-x"),
      request(app.getHttpServer())
        .get("/authenticated-async-chain")
        .set("x-test-org", "org-y"),
    ]);

    expect(resX.body).toEqual({ organizationId: "org-x" });
    expect(resY.body).toEqual({ organizationId: "org-y" });
  });
});

describe("OrgContextInterceptor — direct unit test", () => {
  function fakeExecutionContext(user?: {
    organizationId: string;
  }): ExecutionContext {
    return {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  /**
   * `runWithOrgContext` is async — it awaits the callback internally, so a
   * throw from `next.handle()` becomes a *rejected promise* rather than a
   * synchronous exception. Without the `.catch()` forwarding it to the
   * subscriber, this would be an unhandled rejection and the returned
   * Observable would simply never emit (the HTTP response would hang).
   * This can't be reproduced through the full HTTP pipeline above, because
   * RxJS's own `defer`/`subscribe` machinery already catches a throw from a
   * *real* Nest `CallHandler.handle()` before it ever reaches this
   * interceptor's callback — so this test calls `intercept()` directly with
   * a `CallHandler` stand-in that throws before returning an Observable.
   */
  it("forwards a synchronous throw from next.handle() to the subscriber instead of an unhandled rejection", async () => {
    const interceptor = new OrgContextInterceptor();
    const thrown = new Error("next.handle() failed synchronously");
    const next: CallHandler = {
      handle: () => {
        throw thrown;
      },
    };

    const result = interceptor.intercept(
      fakeExecutionContext({ organizationId: "org-1" }),
      next,
    );

    await expect(
      new Promise((resolve, reject) => {
        result.subscribe({ next: resolve, error: reject });
      }),
    ).rejects.toBe(thrown);
  });

  it("still emits normally when next.handle() succeeds", async () => {
    const interceptor = new OrgContextInterceptor();
    const next: CallHandler = { handle: () => of("ok") };

    const result = interceptor.intercept(
      fakeExecutionContext({ organizationId: "org-1" }),
      next,
    );

    const value = await new Promise((resolve, reject) => {
      result.subscribe({ next: resolve, error: reject });
    });
    expect(value).toBe("ok");
  });
});
