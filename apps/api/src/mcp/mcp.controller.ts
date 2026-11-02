import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { RetrievalService } from "../retrieval/retrieval.service";
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
  policy: {
    rules: string[];
  };
  answer: string;
}

interface RequestWithJwtUser extends Request {
  user: AuthenticatedUser;
}

@Controller("mcp")
export class MCPController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly retrieval: RetrievalService,
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

    // Stub policy – will be replaced with real policy evaluation in a later slice.
    const policy = {
      rules: ["Use TypeScript", "Follow clean architecture"],
    };

    // Org comes from the JWT only, never from the request body.
    const chunks = await this.retrieval.search(query, organizationId);
    const bundle = this.bundles.assemble(chunks);

    return {
      scope,
      context: bundle.chunks.map((chunk) => chunk.content),
      citations: bundle.citations,
      policy,
      answer: this.bundles.composeAnswer(query, bundle),
    };
  }
}
