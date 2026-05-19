# Ubiquitous Language

## Platform scope

| Term             | Definition                                                                      | Aliases to avoid                         |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| **Cortex**       | A company-wide AI context and policy layer exposed through MCP.                 | Pulse, AI gateway                        |
| **Organization** | A tenant boundary representing one customer company.                            | Tenant (in user-facing docs), Account    |
| **Department**   | A policy scope within an Organization that groups users by function.            | Team (when policy scope is meant), Group |
| **MCP Client**   | An external AI tool that connects to Cortex through MCP.                        | Agent tool, Assistant app                |
| **Admin**        | A user who configures organizations, users, sources, policies, and audit views. | Operator, Superuser                      |

## Identity and access

| Term                   | Definition                                                                  | Aliases to avoid                                             |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **User**               | An authenticated human identity belonging to one Organization.              | Account, Login                                               |
| **Google SSO**         | The authentication flow where Google identity is used to sign in to Cortex. | Social login, OAuth shortcut                                 |
| **Session Token**      | A signed credential used by web and MCP requests to prove identity.         | API key (unless it is specifically a long-lived key), Cookie |
| **Primary Department** | The department used as default policy context for a User request.           | Home team, Main group                                        |

## Knowledge and retrieval

| Term               | Definition                                                                   | Aliases to avoid                                |
| ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| **Source**         | A configured upstream knowledge origin such as upload, Slack, or Confluence. | Connector (for domain docs), Integration record |
| **Document**       | A normalized unit of source content stored for retrieval.                    | File, Page                                      |
| **Chunk**          | A retrievable segment of a Document used in similarity search.               | Snippet, Segment (unless technically different) |
| **Embedding**      | A vector representation of text used for semantic retrieval.                 | Index token, Fingerprint                        |
| **Context Bundle** | The selected set of retrieved Chunks assembled for one AI response.          | Prompt context, Retrieval payload               |

## Policy and governance

| Term                | Definition                                                                                | Aliases to avoid                           |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Policy**          | A versioned department-scoped rule set that controls query and response behavior.         | Guardrail config, Prompt rules             |
| **Policy Decision** | The recorded result of evaluating Policy rules for a request.                             | Verdict, Rule output                       |
| **Hard Deny**       | A policy outcome that blocks request processing and returns a deny reason.                | Soft fail, Retryable block                 |
| **Redaction**       | The removal or masking of forbidden content in a response.                                | Filter (when masking is intended), Cleanup |
| **Audit Log**       | An immutable record of query input, context usage, policy decisions, and output metadata. | History, Activity stream                   |

## Relationships

- A **User** belongs to exactly one **Organization** for MVP scope.
- A **User** is mapped to one or more **Departments**, with one **Primary Department**.
- A **Policy** belongs to exactly one (**Organization**, **Department**) scope and has versions.
- A **Source** belongs to one **Organization** and produces many **Documents**.
- A **Document** produces many **Chunks**.
- An MCP query from an **MCP Client** produces one **Policy Decision** and one **Audit Log** entry.
- A **Context Bundle** contains multiple **Chunks** selected under **Policy** constraints.

## Example dialogue

> **Dev:** "When a **User** asks through a connected IDE, what scope do we resolve first?"  
> **Domain expert:** "Resolve the **Organization** and the **Primary Department** first, then load the active **Policy**."  
> **Dev:** "So retrieval pulls a **Context Bundle** from **Chunks**, but only from allowed **Sources**?"  
> **Domain expert:** "Exactly, and every step becomes part of the **Policy Decision** and final **Audit Log**."  
> **Dev:** "If a rule triggers a **Hard Deny**, do we still log it?"  
> **Domain expert:** "Yes, denials are critical audit events and must be recorded."

## Flagged ambiguities

- "Tenant" and **Organization** were used interchangeably; prefer **Organization** in product language and reserve "tenant isolation" for technical discussion.
- "Admin web", "admin dashboard", and "web" referred to the same UI; prefer **Admin Web** as the product term and `web` only as a repo app name.
- "Policy", "rule", and "guardrail" were mixed; use **Policy** for the versioned set, **rule** for an individual condition/action, and avoid "guardrail" in specifications.
- "Context", "RAG", and "retrieval" were loosely mixed; use **Context Bundle** for output, **retrieval** for the process, and **RAG** only for architecture-level discussions.
