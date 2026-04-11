---
title: "AI Companion: Runtime Host Surfaces Domain Overview"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - electron/main
---
# AI Companion: Runtime Host Surfaces Domain Overview

## Purpose

Own runtime-specific host assembly and startup lifecycle boundaries for desktop, web, server, and worker surfaces.

## Boundary

- Defines host authority boundaries, startup sequencing, and pre-login versus post-login runtime responsibilities.
- Delegates inner business policy to core-platform-and-composition and security policy logic to identity-trust-and-security.

## Foundational Concepts

- Host entrypoints and composition roots are the runtime authority for process bootstrap, dependency wiring, and staged startup.
- Electron main/preload/renderer boundaries remain explicit: main owns host capabilities, preload exposes typed bridges, renderer consumes bridge contracts.
- Host mode is a first-class concern (desktop, browser fallback, authoritative server, worker), with mode-aware composition but shared inner contracts.
- Runtime health and managed-service supervision are part of host responsibility, including provisioning, launchability checks, and degraded-state signaling.
- Pre-login and post-login startup phases are intentionally separated to keep identity/session readiness deterministic before runtime-heavy warmup.

## Domain-Wide Invariants

- Host surfaces may expose capabilities through typed adapters but must avoid leaking host internals into domain/application contracts.
- Persistent desktop truth lives in host-owned durable stores; browser/local fallbacks are bounded and non-authoritative for protected behavior.
- Runtime dependency orchestration outcomes must be explicit (`healthy`, `degraded`, `failed`, etc.) rather than implicit booleans.
- Startup and connectivity transitions are host-owned lifecycle concerns, not page-level state conventions.

## Cross-Domain Dependency Rules

- `identity-trust-and-security` owns authentication/session policy; runtime hosts consume readiness outcomes and enforce startup gating.
- `api-and-transport-surfaces` owns authoritative HTTP/event contracts; host bridges and IPC remain adapters.
- `core-platform-and-composition` owns business semantics; runtime hosts only compose and expose outer capabilities.
- `execution-control-plane-and-scheduling` owns run lifecycle state; hosts only transport commands and status.

## Seed Scope Guidance

- Prioritize host composition root and startup lifecycle references used by all runtime surfaces.
- Keep host-specific operational procedures in docs/operations and link outward when needed.
- Treat this domain as runtime authority, not feature ownership.

## Canonical Source Documents Migrated into This Overview

- [Desktop Runtime and Hosts](../../desktop-runtime-and-hosts.md)
- [Authoritative Server Host Assembly](../../authoritative-server-host-assembly.md)
- [Web Host Assembly](../../web-host-assembly.md)
- [Worker Host Assembly](../../worker-host-assembly.md)

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
- [adr-005-trust-identity-and-security-boundary-enforcement.md](../../../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Runtime And Host](../../../context/packs/runtime-and-host.pack.md)

