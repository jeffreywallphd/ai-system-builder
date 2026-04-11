---
title: "AI Companion: Deployment Policy and Audit Governance Domain Overview"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/deployment
  - src/domain/audit
  - src/application/policy-administration
---
# AI Companion: Deployment Policy and Audit Governance Domain Overview

## Purpose

Own governance architecture for deployment policy administration, policy explainability, and audit evidence recording.

## Boundary

- Defines deployment policy resolution/override boundaries and audit recording authority contracts.
- Delegates runtime dispatch mechanics to execution-control-plane-and-scheduling and identity proofing to identity-trust-and-security.

## Seed Scope Guidance

- Seed references for policy administration authority and audit ledger/event contracts first.
- Keep governance architecture authoritative here while linking outward for runtime behavior details.
- Avoid embedding implementation task plans; keep this domain focused on durable governance contracts.

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

- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)
