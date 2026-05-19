import { Controller, Post, Body } from '@nestjs/common';

@Controller('mcp')
export class MCPController {
    @Post()
    async handleMCP(@Body() body: any) {
        const { query, userId } = body;

        // STEP 1: mock identity resolution (Day 1 simplified)
        const user = {
            id: userId,
            department: 'engineering',
            organizationId: 'org_1',
        };

        // STEP 2: mock policy
        const policy = {
            rules: ['Use TypeScript', 'Follow clean architecture'],
        };

        // STEP 3: mock context retrieval
        const context = [
            'Company uses modular monolith architecture',
            'No direct DB access from controllers',
        ];

        // STEP 4: response assembly
        return {
            context,
            policy,
            answer: `Based on company standards: ${query}`,
        };
    }
}