---
title: "AI Companion: API and Transport Surfaces Domain Overview"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/infrastructure/api
  - src/infrastructure/transport
---
# AI Companion: API and Transport Surfaces Domain Overview

## Purpose

Own transport-facing route, endpoint, and event contracts that expose domain/application capabilities without redefining business policy.

## Boundary

- Defines unified API surface boundaries, transport semantics, and request/response or event contract expectations.
- Delegates policy source-of-truth to domains that own business logic and governance authority.

## Seed Scope Guidance

- Seed references around canonical endpoint families and shared transport contract conventions.
- Document transport durability and compatibility expectations in focused reference files.
- Keep business policy rationale in owning domains and link instead of duplicating.

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
- [Repository Overview](../../../context/packs/repository-overview.pack.md)
