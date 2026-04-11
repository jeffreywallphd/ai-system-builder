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

Define fail-closed boundaries for identity proof, trust posture, authorization enforcement, and secret-safe observability.

## Scope and System Boundary

In scope:
- Identity and session lifecycle trust contracts.
- Authorization evaluation and enforcement boundaries.
- Secret handling and redaction-safe diagnostics guardrails.

Out of scope:
- Workspace tenancy ownership semantics.
- Transport protocol catalogs and endpoint payload tables.
- Runtime host startup orchestration mechanics.

## Canonical Responsibilities

- Keep protected access decisions fail-closed on missing or invalid trust context.
- Maintain explicit boundaries between identity/session, authorization, and secret handling surfaces.
- Provide durable policy seams consumed by other domains without reimplementation.

## Cross-Cutting Invariants

- Secret-bearing values never appear in read models or unredacted logs.
- Credential/session transitions are explicit and guard-validated.
- Policy evaluation remains in domain/application seams, not UI or transport shortcuts.

## Integration and Dependency Boundaries

- `workspace-storage-and-assets` owns tenancy/resource contracts that this domain gates.
- `api-and-transport-surfaces` publishes security endpoints without redefining security policy.
- `runtime-host-surfaces` may expose secure-storage/trust adapters but not trust decisions.
- `deployment-policy-and-audit-governance` consumes security events for governance evidence.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Identity Proof and Session Trust Contracts](./references/identity-proof-and-session-trust-contracts.md)

## Canonical Source Documents Migrated into This Domain

- [Identity Foundation](../../identity-foundation.md)
- [Identity Session Architecture](../../identity-session-architecture.md)
- [Authorization Foundation](../../authorization-foundation.md)
- [Transport Security Foundation](../../transport-security-foundation.md)

## Related ADRs

- [adr-005-trust-identity-and-security-boundary-enforcement.md](../../../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Identity And Security](../../../context/packs/identity-and-security.pack.md)

## Related Contributor and Operations Guidance

- [Authorization Sharing Management And Access Review](../../../authorization-sharing-management-and-access-review.md)
- [Security Policy Configuration Operations](../../../security-policy-configuration-operations.md)
- [Secret Health And Operational Diagnostics](../../../secret-health-and-operational-diagnostics.md)

## Related Code Paths

- [src/application/identity](../../../../src/application/identity)
- [src/application/authorization](../../../../src/application/authorization)
- [src/infrastructure/security](../../../../src/infrastructure/security)
- [src/domain/security](../../../../src/domain/security)
