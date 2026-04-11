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

## Seed Scope Guidance

- Seed references around trust proofs, authorization contracts, and secret lifecycle boundaries first.
- Use reference docs to capture normative fail-closed behavior and policy decision seams.
- Avoid duplicating transport payload catalogs or operations runbooks in this domain.

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
