---
title: Core Platform and Composition Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain
  - src/application
---
# Core Platform and Composition Domain Overview

## Purpose

Own the inner system model and composition contracts that define platform behavior independently of runtime host adapters.

## Boundary

- Defines domain and application layering invariants, shared model semantics, and composition seams.
- Delegates host startup mechanics to runtime-host-surfaces and transport wire contracts to api-and-transport-surfaces.

## Seed Scope Guidance

- Start migration with layer boundary and composition root contracts that multiple domains depend on.
- Keep this overview as the single boundary authority and route detail into focused reference docs.
- Avoid duplicating runtime bootstrap, route payload, or runbook details here.

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

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Context System Foundations](../../../context/packs/context-system-foundations.pack.md)
