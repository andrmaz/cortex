import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { PolicyDecision } from "@cortex/shared/policy";
import { PolicyRuntimeService } from "../policy/policy-runtime.service";
import { ContextBundleService } from "./context-bundle.service";
import type { Citation } from "./context-bundle.service";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { IdentityService } from "./identity.service";
import type { ResolvedScope } from "./identity.service";

interface MCPQueryBody {
  query: string;
}

interface MCPResponse {
  scope: ResolvedScope;
  context: string[];
  citations: readonly Citation[];
  policy: PolicyDecision;
  answer: string;
}

export interface RequestWithJwtUser extends Request {
  user: AuthenticatedUser;
  policyDecision?: PolicyDecision;
}

@Controller("mcp")
export class MCPController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly policies: PolicyRuntimeService,
    private readonly bundles: ContextBundleService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async handleMCP(
    @Body() body: MCPQueryBody,
    @Req() req: RequestWithJwtUser,
  ): Promise<MCPResponse> {
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (query.length === 0) {
      throw new BadRequestException("query must be a non-empty string");
    }
    const { id: userId, organizationId } = req.user;

    const scope = await this.identityService.resolveScope(
      userId,
      organizationId,
    );

    const evaluation = await this.policies.evaluate(scope, query);
    req.policyDecision = evaluation.decision;
    const chunks =
      evaluation.decision.decision === "deny" ? [] : evaluation.chunks;
    const bundle = this.bundles.assemble(chunks);

    return {
      scope,
      context: bundle.chunks.map((chunk) => chunk.content),
      citations: bundle.citations,
      policy: evaluation.decision,
      answer:
        evaluation.decision.decision === "deny"
          ? (evaluation.decision.reason ?? "Request denied.")
          : this.bundles.composeAnswer(query, bundle),
    };
  }
}
