# Plan: Cortex MVP (MCP-First Context and Policy Layer)

> Source PRD: [Cortex MVP PRD](./cortex-mvp-prd.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture**: TypeScript end-to-end, modular monolith backend, separate Admin Web app, separate worker process sharing one database.
- **Routes**: API under `/api/*`, MCP entrypoint under `/mcp`, auth flow under `/auth/google/*`, admin pages for organizations, users/departments, sources, policies, and audit logs.
- **Schema**: Multi-organization schema centered on organizations, users, departments, sources, documents, chunks, policies, and query logs; all query paths scoped by Organization.
- **Key models**: Organization, User, Department, UserDepartment, Source, Document, Chunk, Policy, QueryLog.
- **Auth and authorization**: Google OAuth for sign-in, JWT/session tokens for authenticated requests, department resolution per user, org isolation enforced in all reads/writes.
- **RAG approach**: Ingestion to chunked documents with embeddings; retrieval constrained by Organization and Policy before Context Bundle assembly.
- **Policy approach**: Department-scoped JSON rules with deterministic pre-retrieval and post-retrieval enforcement.
- **Infra boundaries**: PostgreSQL + Prisma for primary storage, pgvector for vector search (MVP default), Redis + BullMQ for async ingestion jobs.

---

## Phase 1: Authenticated MCP Skeleton

**User stories**: 1, 2, 3, 18, 21

### What to build

Deliver the first thin end-to-end path where a user signs in with Google, obtains an authenticated session/token, calls Cortex through MCP, and receives an identity-scoped response. This phase proves MCP-first integration and auth plumbing without full context retrieval.

### Acceptance criteria

- [ ] A user can complete Google SSO and obtain a valid authenticated session/token.
- [ ] An MCP client can call Cortex with authentication and receive a valid response.
- [ ] The MCP response contains resolved identity context (organization and department scope).
- [ ] Unauthorized or invalid tokens are rejected with clear error responses.

---

## Phase 2: Tenant and Org Control Plane

**User stories**: 6, 7, 17

### What to build

Introduce organization and department management needed for Organization isolation and Policy targeting. Admin workflows can manage users and assign departments, and the MCP/API request path consistently enforces Organization boundaries.

### Acceptance criteria

- [ ] Admin can manage organizations and map users to departments.
- [ ] Department assignments are used in authenticated request processing.
- [ ] Cross-organization data access is blocked by default.
- [ ] Organization-scoping rules are verifiable through API and MCP calls.

---

## Phase 3: Source Onboarding and Ingestion Pipeline

**User stories**: 10, 11, 12, 19

### What to build

Implement a complete ingestion slice: register a source (including file upload path), enqueue jobs, normalize content, chunk text, generate embeddings, and persist indexed artifacts with status visibility for admins.

### Acceptance criteria

- [ ] Admin can register at least one source type and trigger ingestion.
- [ ] Ingestion runs asynchronously through the queue and updates status.
- [ ] Documents and chunks are persisted with tenant ownership metadata.
- [ ] Failed ingestion jobs surface actionable error states.

---

## Phase 4: Context Retrieval in Live MCP Answers

**User stories**: 4, 5, 21

### What to build

Replace mocked MCP answers with real retrieval-grounded answers. For an authenticated user query, Cortex retrieves top relevant chunks from permitted Organization data, assembles a Context Bundle, and returns a cited response payload through MCP.

### Acceptance criteria

- [ ] MCP query path uses retrieval from indexed Organization Documents.
- [ ] Returned answers include references/citations to retrieved context.
- [ ] Retrieval quality is sufficient for a realistic demo scenario.
- [ ] Retrieval respects organization scoping on every request.

---

## Phase 5: Department Policy Enforcement

**User stories**: 8, 9, 16, 23

### What to build

Add a policy editor and runtime evaluator that applies department-specific JSON rules to requests and responses. Support deny constraints, source filtering, and response redaction with traceable decision outputs.

### Acceptance criteria

- [ ] Admin can create, update, and activate department policy configurations.
- [ ] Policy evaluation runs in deterministic order during MCP request handling.
- [ ] Deny and redaction behaviors are enforced in response outputs.
- [ ] Policy reason traces are generated for downstream audit visibility.

---

## Phase 6: Auditability and Explainability

**User stories**: 13, 14, 15, 24

### What to build

Capture complete audit records for every AI query and expose them in the admin audit viewer. Logs include request context, policy decisions, selected sources/chunks, and response metadata with practical filtering.

### Acceptance criteria

- [ ] Every MCP query produces a persisted audit log entry.
- [ ] Audit entries include actor, Organization, Department, Policy Decision trace, and Context Bundle references.
- [ ] Admin can filter logs by time, user, and department.
- [ ] Audit records are append-only and suitable for governance review.

---

## Phase 7: Demo Hardening and MVP Polish

**User stories**: 20, 22, 25

### What to build

Stabilize the full end-to-end experience for a repeatable stakeholder demo. Finalize key UX and reliability gaps, validate configuration flows, and prepare a deterministic demo script showing policy-compliant, context-aware MCP responses with auditable evidence.

### Acceptance criteria

- [ ] End-to-end demo path runs reliably from login to audited MCP response.
- [ ] Admin UX handles invalid inputs with clear feedback.
- [ ] Seed/sample data supports a repeatable “wow moment” scenario.
- [ ] MVP scope remains constrained to the defined non-goals.
