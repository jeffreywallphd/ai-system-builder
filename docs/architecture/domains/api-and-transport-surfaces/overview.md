---
title: API and Transport Surfaces Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/infrastructure/api
  - src/infrastructure/transport
---
# API and Transport Surfaces Domain Overview

## Purpose

Own transport-facing route, endpoint, and event contracts that expose domain/application capabilities without redefining business policy.

## Boundary

- Defines unified API surface boundaries, transport semantics, and request/response or event contract expectations.
- Delegates policy source-of-truth to domains that own business logic and governance authority.

## Foundational Concepts

- Protected client operations must converge on one authoritative server API surface with shared DTO and schema contracts.
- Contract ownership is explicit: shared contracts/schemas define stable wire semantics; backend APIs orchestrate use cases; transport adapters enforce boundary validation.
- Desktop preload and host IPC remain adapter seams, not authoritative protected-resource APIs.
- Migration posture is explicit: legacy bypass paths may exist temporarily but must converge to shared API clients and authoritative transport.
- Error envelopes and compatibility behavior are shared-contract concerns, preventing UI-specific transport drift.

## Domain-Wide Invariants

- New protected operations must define shared contracts and schemas before transport/UI integration.
- UI-only DTO forks, direct protected local storage authority, and auth-bypass shortcuts are non-compliant.
- Transport handlers validate and normalize requests; business-policy decisions stay in domain/application layers.
- Realtime and event semantics should use shared contracts, not client-local protocol variants.

## Cross-Domain Dependency Rules

- `identity-trust-and-security` governs auth/session/authorization checks consumed at authoritative transport boundaries.
- `core-platform-and-composition` and feature domains own business semantics that API surfaces expose.
- `runtime-host-surfaces` may provide desktop adapter channels, but protected behavior converges through authoritative API paths.
- `deployment-policy-and-audit-governance` may require explainability/audit metadata exposed by API contracts.

## Seed Scope Guidance

- Seed references around canonical endpoint families and shared transport contract conventions.
- Document transport durability and compatibility expectations in focused reference files.
- Keep business policy rationale in owning domains and link instead of duplicating.

## Canonical Source Documents Migrated into This Overview

- [Unified API Authoritative Surface](../../unified-api-authoritative-surface.md)
- [Unified API Endpoint Reference](../../unified-api-endpoint-reference.md)
- [Unified API Convergence Plan](../../unified-api-convergence-plan.md)
- [Shared API Contract Package](../../shared-api-contract-package.md)

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
