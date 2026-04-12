---
title: Runtime Host Surfaces Domain References
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - electron/main
---
# Runtime Host Surfaces Domain References

## Purpose

Index durable contract-level architecture references for `runtime-host-surfaces` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Host composition-root authority contracts.
- Startup lifecycle and gating contracts.
- Pre-login vs post-login runtime capability boundaries.

## Canonical Reference Documents

- [Host Composition Root Contracts](./host-composition-root-contracts.md)

## Migration Backlog (Not Yet Canonical)

- `startup-lifecycle-and-gating.md`
- `pre-login-runtime-surface-boundaries.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)

## Related Contributor and Operations Guidance

- [Node Bootstrap Identity Operations](../../../../node-bootstrap-identity-operations.md)
- [Operations Router](../../../../operations/README.md)

## Related Code Paths

- [src/hosts](../../../../../src/hosts)
- [src/infrastructure/runtime](../../../../../src/infrastructure/runtime)
- [electron/main](../../../../../electron/main)
