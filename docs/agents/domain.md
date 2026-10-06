# Domain Docs

Cortex uses a single domain context.

Before exploring or changing behavior:

- Read the root [`GLOSSARY.md`](../../GLOSSARY.md) and use its canonical terms.
- Read relevant architecture decision records under `docs/adr/` when that directory exists.

If a needed concept is absent, reconsider whether the codebase already names it. Use `/domain-modeling` to add a term only when a real domain gap is resolved. Create an ADR only for a consequential, surprising, hard-to-reverse decision with genuine alternatives.

Surface conflicts with existing domain language or ADRs instead of silently overriding them.
