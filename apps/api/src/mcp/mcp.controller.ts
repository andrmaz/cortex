import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
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
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async handleMCP(
    @Body() body: MCPQueryBody,
    @Req() req: RequestWithJwtUser,
  ): Promise<MCPResponse> {
    const { query } = body;
    const { id: userId, organizationId } = req.user;

    const scope = await this.identityService.resolveScope(
      userId,
      organizationId,
    );

    // Stub policy – will be replaced with real policy evaluation in a later slice.
    const policy = {
      rules: ["Use TypeScript", "Follow clean architecture"],
    };

    // Stub context – will be replaced with retrieval in a later slice.
    const context = [
      "Company uses modular monolith architecture",
      "No direct DB access from controllers",
    ];

    return {
      scope,
      context,
      policy,
      answer: `Based on company standards: ${query}`,
    };
  }
}
