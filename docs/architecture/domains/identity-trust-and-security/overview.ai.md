---
title: "AI Companion: Identity Trust and Security Domain Overview"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/identity
  - src/application/authorization
---
# AI Companion: Identity Trust and Security Domain Overview

## Purpose

Own fail-closed architecture boundaries for identity proof, trust establishment, authorization enforcement, and secret handling.

## Boundary

- Defines authentication/session trust, authorization policy enforcement, and security-redaction guardrails.
- Delegates tenancy/resource ownership policy to workspace-storage-and-assets unless the rule is primarily security logic.

## Foundational Concepts

- Identity is provider-oriented (`local` now, external providers later) but platform-owned: user identity remains the stable authorization subject.
- Session lifecycle and token material are separated: session state persists independently from token secret/hash storage.
- Authentication, account lifecycle, credential policy, and session validation use typed operation results with deterministic error taxonomy.
- Trusted-device and trust-marker seams are explicit extension points, not embedded assumptions in core identity entities.
- Authorization and secret-management contracts are fail-closed by default and rely on explicit policy checks plus redaction-safe observability.

## Domain-Wide Invariants

- Protected access decisions must fail closed on missing credentials, invalid session state, unsupported provider paths, or policy violations.
- Credential and token secrets never appear in read models or logs; redaction/allowlist serializers are mandatory boundaries.
- Identity lifecycle and credential/session transitions are explicit and guard-validated.
- Security policy evaluation belongs in domain/application seams, not in UI or transport shortcuts.

## Cross-Domain Dependency Rules

- `workspace-storage-and-assets` owns workspace/resource ownership; this domain enforces identity/trust and authorization gates over those resources.
- `api-and-transport-surfaces` publishes authentication/session endpoints but must not redefine identity policy.
- `runtime-host-surfaces` may expose trust posture and secure-storage adapters, but trust decisions remain governed here.
- `deployment-policy-and-audit-governance` consumes security events and policy outcomes for governance evidence.

## Seed Scope Guidance

- Seed references around trust proofs, authorization contracts, and secret lifecycle boundaries first.
- Use reference docs to capture normative fail-closed behavior and policy decision seams.
- Avoid duplicating transport payload catalogs or operations runbooks in this domain.

## Canonical Source Documents Migrated into This Overview

- [Identity Foundation](../../identity-foundation.md)
- [Identity Session Architecture](../../identity-session-architecture.md)
- [Authorization Foundation](../../authorization-foundation.md)
- [Transport Security Foundation](../../transport-security-foundation.md)

## What Belongs in the Overview

- Domain boundary intent, ownership seams, and cross-domain dependency rules.
- Domain-wide invariants that shape multiple reference contracts.
- Concise routing links to the canonical reference documents in ./references/.

## What Does Not Belong in the Overview

- Endpoint-level schemas, API payload matrices, and low-level interface catalogs.
- Step-by-step operational runbooks and troubleshooting procedures.
- Contributor process checklists, implementation task plans, or release notes.

## Related Domain References

- [Domain References Index](./references/README.md)

## Related ADRs

- [adr-005-trust-identity-and-security-boundary-enforcement.md](../../../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Identity And Security](../../../context/packs/identity-and-security.pack.md)

