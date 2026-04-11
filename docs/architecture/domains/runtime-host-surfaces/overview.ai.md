---
title: "AI Companion: Runtime Host Surfaces Domain Overview"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - electron/main
---
# AI Companion: Runtime Host Surfaces Domain Overview

## Purpose

Own runtime-specific host assembly and startup lifecycle boundaries for desktop, web, server, and worker surfaces.

## Boundary

- Defines host authority boundaries, startup sequencing, and pre-login versus post-login runtime responsibilities.
- Delegates inner business policy to core-platform-and-composition and security policy logic to identity-trust-and-security.

## Seed Scope Guidance

- Prioritize host composition root and startup lifecycle references used by all runtime surfaces.
- Keep host-specific operational procedures in docs/operations and link outward when needed.
- Treat this domain as runtime authority, not feature ownership.

## What Belongs in the Overview

- Domain boundary intent, ownership seams, and cross-domain dependency rules.
- Domain-wide invariants that shape multiple reference contracts.
- Concise routing links to the canonical reference documents in ./references/.

## What Does Not Belong in the Overview

- Endpoint-level schemas, API payload matrices, and low-level interface catalogs.
- Step-by-step operational runbooks and troubleshooting procedures.
- Contributor process checklists, implementation task plans, or release notes.

## Related Domain References

- [Domain References Index](./references/README.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Runtime And Host](../../../context/packs/runtime-and-host.pack.md)
