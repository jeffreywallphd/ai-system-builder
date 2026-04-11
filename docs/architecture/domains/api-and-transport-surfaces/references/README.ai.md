---
title: API and Transport Surfaces Domain References
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/infrastructure/api
  - src/infrastructure/transport
---
# API and Transport Surfaces Domain References

## Purpose

Index durable contract-level architecture references for `api-and-transport-surfaces` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Unified API authority and route-family contracts.
- Request/response validation and compatibility contracts.
- Event publication/subscription contract boundaries.

## Canonical Reference Documents

- [Unified API Surface Contracts](./unified-api-surface-contracts.md)

## Migration Backlog (Not Yet Canonical)

- `transport-request-response-contracts.md`
- `event-publication-and-subscription-contracts.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)

## Related Contributor and Operations Guidance

- [Unified API Contributor Guide](../../../../unified-api-contributor-guide.md)
- [Unified API Observability Troubleshooting](../../../../unified-api-observability-troubleshooting.md)

## Related Code Paths

- [src/infrastructure/api](../../../../../src/infrastructure/api)
- [src/infrastructure/transport](../../../../../src/infrastructure/transport)
- [src/application/contracts](../../../../../src/application/contracts)
