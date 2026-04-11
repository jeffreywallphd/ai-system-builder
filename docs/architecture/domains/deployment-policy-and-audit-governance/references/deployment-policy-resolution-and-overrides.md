---
title: Deployment Policy Resolution and Overrides
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/deployment
  - src/domain/audit
  - src/application/policy-administration
---
# Deployment Policy Resolution and Overrides

## Context and Scope

This reference defines policy resolution order, override controls, and explainability contracts for deployment governance. Boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Policy resolution consumes profile presets, policy defaults, and admin state in deterministic order.
- Control modes (`profile-fixed`, `profile-default-admin-overridable`, `runtime-admin`) gate where mutation is allowed.
- Effective policy snapshots preserve source attribution for explainability and audit review.

## Data and State Invariants

- `profile-fixed` constraints cannot be overridden at runtime.
- Invalid inheritance cycles or unresolved policy references are rejected before activation.
- Effective policy output remains deterministic for identical input state.

## Failure and Recovery Semantics

- Invalid policy mutations fail with explicit validation reasons and no partial activation.
- Resolution failures preserve the last known valid effective policy state.
- Recovery requires explicit correction and re-evaluation under the same control-mode constraints.

## Extension Guardrails

- Add policy families with typed validation and explicit control-mode behavior.
- Keep policy evaluation in domain/application seams, not in endpoint-local logic.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Deployment Profile Policy Administration Foundation](../../../deployment-profile-policy-administration-foundation.md)
- [Deployment Profile Policy Effective Resolution and Overrides](../../../deployment-profile-policy-effective-resolution-and-overrides.md)
- [Audit Domain Foundation](../../../audit-domain-foundation.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../../context/packs/repository-overview.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
