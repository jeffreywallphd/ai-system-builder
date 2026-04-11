---
title: Runtime Host Surfaces Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - electron/main
---
# Runtime Host Surfaces Domain Overview

## Purpose

Define host assembly, startup lifecycle, and runtime-capability boundaries for desktop, web, server, and worker hosts.

## Domain Summary for Fast Context Selection

- Primary focus: Host composition, startup lifecycle, and runtime capability gating across desktop, web, server, and worker modes.
- Boundary line: Owns host assembly and readiness semantics; does not own inner business-policy decisions or transport contract catalogs.
- Why it matters: Incorrect host boundaries can bypass trust gates or create inconsistent startup/readiness behavior across runtimes.
- Context-pack relationship: This overview defines architecture boundaries. Context packs in `docs/context/packs/` assemble task-specific retrieval and should reference this domain instead of duplicating it.

## Scope and System Boundary

In scope:
- Host composition roots and startup sequencing contracts.
- Pre-login and post-login runtime capability boundaries.
- Runtime health/degradation signaling owned by hosts.

Out of scope:
- Identity policy decisions and trust proof logic.
- Business-model semantics from inner domain/application layers.
- Endpoint wire schemas and API payload catalogs.

## Canonical Responsibilities

- Keep host mode differences explicit while preserving shared inner contracts.
- Expose capabilities through typed host adapters rather than leaking host internals.
- Surface deterministic startup and readiness outcomes for downstream consumers.

## Cross-Cutting Invariants

- Startup phases are explicit; no implicit readiness assumptions.
- Protected runtime capability remains gated by identity/session readiness.
- Host-specific fallbacks remain non-authoritative for protected operations.

## Integration and Dependency Boundaries

- `identity-trust-and-security` supplies readiness outcomes for auth-first startup gating.
- `api-and-transport-surfaces` owns authoritative route/event contracts consumed by host adapters.
- `execution-control-plane-and-scheduling` owns run lifecycle transitions; hosts transport commands.
- `core-platform-and-composition` owns business semantics and inner service contracts.

## Domain Boundary Notes for Common Confusion

- `runtime-host-surfaces` vs `execution-control-plane-and-scheduling`: this domain owns startup/readiness assembly and host capability gates; control-plane scheduling and lifecycle authority stays in `execution-control-plane-and-scheduling`.
- `runtime-host-surfaces` vs `api-and-transport-surfaces`: this domain composes host adapters and startup wiring; API domain owns authoritative route and payload contracts.
- `runtime-host-surfaces` vs operations docs: this overview defines runtime architecture boundaries, while host runbooks and incident response belong in `docs/operations/`.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Host Composition Root Contracts](./references/host-composition-root-contracts.md)

## Canonical Source Documents Migrated into This Domain

- [Desktop Runtime and Hosts](../../desktop-runtime-and-hosts.md)
- [Authoritative Server Host Assembly](../../authoritative-server-host-assembly.md)
- [Web Host Assembly](../../web-host-assembly.md)
- [Worker Host Assembly](../../worker-host-assembly.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-005-trust-identity-and-security-boundary-enforcement.md](../../../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Runtime And Host](../../../context/packs/runtime-and-host.pack.md)

## Related Contributor and Operations Guidance

- [Node Bootstrap Identity Operations](../../../node-bootstrap-identity-operations.md)
- [Unified API Observability Troubleshooting](../../../unified-api-observability-troubleshooting.md)
- [Operations Router](../../../operations/README.md)

## Related Code Paths

- [src/hosts](../../../../src/hosts)
- [src/infrastructure/runtime](../../../../src/infrastructure/runtime)
- [electron/main](../../../../electron/main)
