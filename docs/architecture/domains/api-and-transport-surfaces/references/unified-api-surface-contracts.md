---
title: Unified API Surface Contracts
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/infrastructure/api
  - src/infrastructure/transport
---
# Unified API Surface Contracts

## Context and Scope

This reference defines authoritative route-family and protected-operation exposure contracts for unified API surfaces. Boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Protected operations are exposed through one authoritative server-facing API surface.
- Route-family ownership is explicit and mapped to underlying domain/application use-case authority.
- Shared contracts/schemas define wire semantics prior to client integration.

## Data and State Invariants

- Protected operations cannot rely on client-local bypass protocol variants.
- Request validation and normalization complete before business-policy execution.
- Response/error envelopes remain contract-stable across host/client modes.

## Failure and Recovery Semantics

- Schema/validation failures return explicit contract errors and never invoke protected policy paths.
- Deprecated legacy/bypass routes remain non-authoritative and must carry migration posture.
- Recovery paths preserve compatibility guarantees while converging clients to authoritative contracts.

## Extension Guardrails

- Add new route families via shared contract packages before adapter-specific usage.
- Keep business policy decisions in domain/application seams, not in route handlers.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Unified API Authoritative Surface](../../../unified-api-authoritative-surface.md)
- [Unified API Endpoint Reference](../../../unified-api-endpoint-reference.md)
- [Shared API Contract Package](../../../shared-api-contract-package.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../../adr/records/adr-001-single-authoritative-control-plane.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../../context/packs/repository-overview.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
