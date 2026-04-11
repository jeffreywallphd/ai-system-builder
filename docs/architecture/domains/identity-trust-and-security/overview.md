---
title: Identity Trust and Security Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/identity
  - src/application/authorization
---

# Identity Trust and Security Domain Overview

## Purpose

Define the architecture boundary for identity-trust-and-security and route future migration of flat architecture references into this domain.

## Boundary

- Owns architecture contracts scoped to the identity-trust-and-security domain taxonomy boundary.
- Should reference adjacent domains for cross-boundary behavior instead of duplicating authority.

## Migration Scope

- Promote domain-summary contracts into this overview when migration stories converge documents.
- Move detailed contracts into ./references/ and keep one canonical source per topic.
- Leave existing flat architecture docs in place until migration stories explicitly move them.

## Related ADRs

- [adr-005-trust-identity-and-security-boundary-enforcement.md](../../../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)

