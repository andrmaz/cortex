# PRD: Cortex MVP (MCP-First Context and Policy Layer)

## Problem Statement

Teams use multiple AI tools, but company context and policy enforcement are inconsistent across tools. This creates inconsistent outputs, governance risk, and weak auditability.

## Solution

Build a minimal but production-ready Cortex MVP as a TypeScript modular monolith that sits between MCP clients and company knowledge systems. Cortex provides shared context retrieval, department policy enforcement, and full audit logs for every AI query.

## User Stories

1. As an employee, I want to connect my AI tool to Cortex via MCP, so that my prompts use company-approved Context Bundles.
2. As an employee, I want SSO login with my Google account, so that I can access Cortex without separate credentials.
3. As an employee, I want my department to be recognized automatically, so that responses follow my team’s rules.
4. As an engineering user, I want answers grounded in technical docs, so that I get implementation-relevant guidance.
5. As a product user, I want answers constrained by roadmap policies, so that sensitive topics are protected.
6. As an admin, I want to create Organizations, so that each company boundary is isolated.
7. As an admin, I want to manage users and departments, so that policy scope maps to real org structure.
8. As an admin, I want to define policy rules per department, so that governance is enforceable and transparent.
9. As an admin, I want to activate and deactivate policy versions, so that policy changes are controlled.
10. As an admin, I want to register data sources, so that company knowledge can be ingested.
11. As an admin, I want to upload documents directly, so that I can demo value before integrations are complete.
12. As an admin, I want ingestion status visibility, so that I can detect failures quickly.
13. As an admin, I want every AI query logged with Context Bundles and Policy Decisions, so that I can audit behavior.
14. As an admin, I want to filter audit logs by user, date, and department, so that investigations are practical.
15. As an admin, I want to inspect which documents and chunks were used, so that answers are traceable.
16. As a security stakeholder, I want denied queries to include reason codes, so that policy actions are explainable.
17. As a platform owner, I want strict Organization isolation in retrieval and logs, so that no cross-organization leakage occurs.
18. As a developer, I want a single deployable backend with clear modules, so that I can ship quickly.
19. As a developer, I want queue-based ingestion jobs, so that heavy indexing does not block request handling.
20. As a demo presenter, I want a stable policy-plus-context-plus-audit walkthrough, so that stakeholders see immediate value.
21. As an MCP client user, I want reliable low-latency responses, so that Cortex feels usable in real workflows.
22. As an admin, I want a policy editor with validation, so that malformed rules do not break queries.
23. As a team lead, I want department-specific source constraints, so that teams only retrieve approved knowledge.
24. As an auditor, I want immutable query records, so that historical behavior can be trusted.
25. As a product owner, I want a 30-day scope with explicit non-goals, so that delivery remains realistic.

## Out of Scope

- Plugin marketplaces or dynamic plugin runtime.
- Microservices decomposition.
- Advanced enterprise ABAC or complex RBAC beyond org role + department mapping.
- Multi-region scaling and distributed architecture concerns for MVP.
