import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Subscriber } from "rxjs";
import { Observable } from "rxjs";
import { runWithOrgContext } from "db";
import type { AuthenticatedUser } from "../auth/auth.types";

interface RequestWithOptionalUser {
  user?: AuthenticatedUser;
}

/**
 * Binds the authenticated caller's `organizationId` as the active org
 * context (see `db`'s `runWithOrgContext`) for the remainder of the request
 * pipeline. Every `PrismaService` query made while handling this request is
 * therefore automatically scoped to that organization at the query layer —
 * controllers and services don't need to remember to filter by org
 * themselves.
 *
 * Requests with no authenticated user (public routes, e.g. the OAuth
 * callback) run with no org context. Any org-scoped Prisma call reachable
 * from such a route must use `runWithoutOrgScope(...)` explicitly.
 *
 * Registered globally in `AppModule` via `APP_INTERCEPTOR`, which runs after
 * guards — so `request.user`, when present, has already been populated by
 * `JwtAuthGuard` by the time this interceptor executes.
 */
@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser>();
    const organizationId = request.user?.organizationId;
    if (!organizationId) {
      return next.handle();
    }

    return new Observable((subscriber: Subscriber<unknown>) => {
      // `runWithOrgContext` is async: it awaits the callback's return value
      // (including lazy thenables) internally, so it must itself be
      // consumed here rather than left as a floating promise — any
      // synchronous throw from `next.handle()`/`subscribe()` becomes a
      // rejection that needs forwarding to the subscriber's error channel.
      runWithOrgContext(organizationId, () => {
        next.handle().subscribe(subscriber);
      }).catch((err: unknown) => subscriber.error(err));
    });
  }
}
