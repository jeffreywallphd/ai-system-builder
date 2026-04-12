---
title: Host Composition Root Contracts
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - electron/main
---
# Host Composition Root Contracts

## Context and Scope

This reference defines composition-root contracts for runtime hosts so startup, adapter wiring, and lifecycle authority remain deterministic. Boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Each runtime host owns one composition root that wires required services and adapters.
- Composition roots select mode-specific adapters (desktop/web/server/worker) without changing inner contract semantics.
- Composition roots expose typed capability boundaries for renderer/IPC/transport consumers.

## Data and State Invariants

- Missing required services or adapters is a startup contract failure.
- Host capability exposure remains explicit and typed rather than implicit global state.
- Runtime mode variation cannot redefine business-policy contracts.

## Failure and Recovery Semantics

- Startup dependency-assembly failures must produce explicit `degraded` or `failed` lifecycle outcomes.
- Hosts fail closed for protected operations when identity/session readiness is unavailable.
- Recovery paths re-run composition-root validation before re-enabling protected capabilities.

## Extension Guardrails

- Add host capability through new adapters wired in composition roots, not through domain-layer imports.
- Keep lifecycle ownership in host surfaces; do not push host bootstrap logic into feature modules.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Desktop Runtime and Hosts](../../../desktop-runtime-and-hosts.md)
- [Authoritative Server Host Assembly](../../../authoritative-server-host-assembly.md)
- [Worker Host Assembly](../../../worker-host-assembly.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-005-trust-identity-and-security-boundary-enforcement.md](../../../../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Runtime And Host](../../../../context/packs/runtime-and-host.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
