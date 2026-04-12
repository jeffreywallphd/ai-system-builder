---
title: Deployment Policy and Audit Governance Domain References
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
# Deployment Policy and Audit Governance Domain References

## Purpose

Index durable contract-level architecture references for `deployment-policy-and-audit-governance` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Deployment policy resolution and override contracts.
- Audit ledger persistence and event governance contracts.
- Authoritative policy-administration command/query contracts.

## Canonical Reference Documents

- [Deployment Policy Resolution and Overrides](./deployment-policy-resolution-and-overrides.md)

## Migration Backlog (Not Yet Canonical)

- `audit-ledger-and-event-governance-contracts.md`
- `policy-administration-authority-surfaces.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)

## Related Contributor and Operations Guidance

- [Deployment Profile Policy Contributor Guide](../../../../deployment-profile-policy-contributor-guide.md)
- [Governance Audit Review Workflows](../../../../governance-audit-review-workflows.md)

## Related Code Paths

- [src/domain/deployment](../../../../../src/domain/deployment)
- [src/domain/audit](../../../../../src/domain/audit)
- [src/application/policy-administration](../../../../../src/application/policy-administration)
