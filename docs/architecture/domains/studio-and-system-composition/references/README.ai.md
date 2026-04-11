---
title: Studio and System Composition Domain References
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/ui/studio-shell
  - src/application/system-studio
  - src/application/workflow-studio
---
# Studio and System Composition Domain References

## Purpose

Index durable contract-level architecture references for `studio-and-system-composition` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Studio handoff boundary contracts.
- Projection/read-model composition contracts.
- Shared system composition seams used across studio surfaces.

## Canonical Reference Documents

- [Studio Handoff and Boundary Contracts](./studio-handoff-and-boundary-contracts.md)

## Migration Backlog (Not Yet Canonical)

- `projection-and-read-model-composition.md`
- `shared-system-composition-seams.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
