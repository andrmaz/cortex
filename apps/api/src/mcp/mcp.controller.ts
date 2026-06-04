import { Controller, Post, Body } from "@nestjs/common";

interface MCPRequestBody {
  query: string;
  userId: string;
}

interface MCPResponse {
  context: string[];
  policy: {
    rules: string[];
  };
  answer: string;
}

@Controller("mcp")
export class MCPController {
  @Post()
  async handleMCP(@Body() body: MCPRequestBody): Promise<MCPResponse> {
    const { query } = body;

    // STEP 2: mock policy
    const policy = {
      rules: ["Use TypeScript", "Follow clean architecture"],
    };

    // STEP 3: mock context retrieval
    const context = [
      "Company uses modular monolith architecture",
      "No direct DB access from controllers",
    ];

    // STEP 4: response assembly
    return {
      context,
      policy,
      answer: `Based on company standards: ${query}`,
    };
  }
}
