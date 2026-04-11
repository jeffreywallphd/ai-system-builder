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

Define transport-facing contracts that expose authoritative capabilities while preserving business-policy ownership in domain/application layers.

## Scope and System Boundary

In scope:
- Unified API route-family authority boundaries.
- Request/response validation and envelope conventions.
- Event publication/subscription contract boundaries.

Out of scope:
- Domain policy semantics and lifecycle rules.
- Runtime host startup sequencing and capability wiring.
- Operations troubleshooting playbooks.

## Canonical Responsibilities

- Keep protected operations on one authoritative server-facing API surface.
- Enforce shared contract/schema validation before business-policy invocation.
- Maintain stable transport/event semantics across host/client modes.

## Cross-Cutting Invariants

- New protected operations require shared contracts and schemas before integration.
- Transport adapters normalize wire input but do not mint policy decisions.
- Client-local protocol forks are non-compliant for protected behavior.

## Integration and Dependency Boundaries

- `identity-trust-and-security` governs auth/session/authorization checks at transport boundaries.
- `core-platform-and-composition` and feature domains own semantics exposed by route handlers.
- `runtime-host-surfaces` provides adapter channels while authoritative behavior converges to unified APIs.
- `deployment-policy-and-audit-governance` may constrain explainability/audit metadata requirements.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Unified API Surface Contracts](./references/unified-api-surface-contracts.md)

## Canonical Source Documents Migrated into This Domain

- [Unified API Authoritative Surface](../../unified-api-authoritative-surface.md)
- [Unified API Endpoint Reference](../../unified-api-endpoint-reference.md)
- [Unified API Convergence Plan](../../unified-api-convergence-plan.md)
- [Shared API Contract Package](../../shared-api-contract-package.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)

## Related Contributor and Operations Guidance

- [Unified API Contributor Guide](../../../unified-api-contributor-guide.md)
- [Unified API Observability Troubleshooting](../../../unified-api-observability-troubleshooting.md)
- [Authorization Sharing Management And Access Review](../../../authorization-sharing-management-and-access-review.md)

## Related Code Paths

- [src/infrastructure/api](../../../../src/infrastructure/api)
- [src/infrastructure/transport](../../../../src/infrastructure/transport)
- [src/application/contracts](../../../../src/application/contracts)
