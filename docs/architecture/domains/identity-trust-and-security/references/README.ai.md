---
title: Identity Trust and Security Domain References
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/identity
  - src/application/authorization
---
# Identity Trust and Security Domain References

## Purpose

Index durable contract-level architecture references for `identity-trust-and-security` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Identity/session trust contracts.
- Authorization enforcement boundary contracts.
- Secret handling and redaction-safe observability contracts.

## Canonical Reference Documents

- [Identity Proof and Session Trust Contracts](./identity-proof-and-session-trust-contracts.md)

## Migration Backlog (Not Yet Canonical)

- `authorization-enforcement-boundary-contracts.md`
- `secret-handling-and-redaction-architecture.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)

## Related Contributor and Operations Guidance

- [Authorization Sharing Management And Access Review](../../../../authorization-sharing-management-and-access-review.md)
- [Security Policy Configuration Operations](../../../../security-policy-configuration-operations.md)

## Related Code Paths

- [src/application/identity](../../../../../src/application/identity)
- [src/application/authorization](../../../../../src/application/authorization)
- [src/infrastructure/security](../../../../../src/infrastructure/security)
