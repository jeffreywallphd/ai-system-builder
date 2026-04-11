---
title: Core Platform and Composition Domain References
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain
  - src/application
---
# Core Platform and Composition Domain References

## Purpose

Index durable contract-level architecture references for `core-platform-and-composition` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Layer direction, dependency, and boundary contracts.
- Composition-root and port-wiring responsibility contracts.
- Shared model invariants that constrain multi-domain integrations.

## Canonical Reference Documents

- [Layer Direction and Dependency Rules](./layer-direction-and-dependency-rules.md)

## Migration Backlog (Not Yet Canonical)

- `application-composition-root-contracts.md`
- `domain-model-shared-invariants.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
