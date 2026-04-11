---
title: ADR-005 Trust, Identity, and Security Boundary Enforcement
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 005
decision_status: accepted
decision_date: 2026-04-11
review_tier: heightened
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/identity/services/IdentityAuthenticatedSessionService.ts
  - src/application/identity/services/TrustedDeviceSessionTrustService.ts
  - src/application/security/use-cases/ValidateTransportConnectionTrustUseCase.ts
  - src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts
  - src/infrastructure/transport/http-server/identity/NodeMutualTlsTransportAdapter.ts
  - src/infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts
  - src/infrastructure/security/TransportSecurityObservabilityReporter.ts
  - src/application/security/use-cases/AuthorizeNodePeerCommunicationUseCase.ts
---

# ADR-005: Trust, Identity, and Security Boundary Enforcement

## Status

accepted

## Decision Date

2026-04-11

## Decision Statement

AI Loom Studio keeps identity proof, session trust, authorization, and transport trust as separate fail-closed gates. Authoritative server boundaries remain the source of truth for protected mutation authorization, trust-state resolution, and security decision audit classification. Runtime/service interactions must provide explicit actor and transport trust context and cannot rely on successful login, host type, or network location as blanket trust.

## Context and Problem Statement

The repository already contains explicit contracts for identity/session flows, trusted-device trust, node trust, transport trust validation, and policy enforcement across multiple hosts/channels. Without a durable decision record, implementation can drift into collapsed trust checks, route-local bypasses, and non-auditable runtime shortcuts.

This ADR records the boundary model so contributors and AI agents extend existing security contracts rather than inferring trust behavior ad hoc.

## Decision Drivers

- Keep authentication, trust, and authorization concerns explicitly separated.
- Preserve deny-by-default behavior and avoid implicit trust inheritance.
- Keep authoritative server boundaries as the policy/mutation enforcement point.
- Preserve redaction-safe auditability for allow/deny security decisions.
- Protect runtime and service channels from identity spoofing and stale trust.

## Considered Options

1. Layered security boundary model with explicit trust domains and centralized enforcement (accepted): preserves composability, auditability, and fail-closed posture.
2. Collapsed "single auth gate" model (rejected): conflates login/session state with authorization and transport trust, raising privilege escalation risk.
3. Per-route/per-host discretionary checks (rejected): creates policy drift, bypass risk, and inconsistent forensic signal.
4. Perimeter/LAN trust-biased model (rejected): conflicts with explicit transport trust contracts and introduces downgrade paths.

## Chosen Approach

Security-sensitive operations must pass four explicit gates at boundary adapters:

- Authentication gate: establish actor/session context only.
- Trust gate: evaluate trusted-device, node, and certificate posture for the transport scenario.
- Authorization gate: evaluate protected resource/workspace capability via centralized policy guards.
- Auditability gate: emit redaction-safe decision events for accepted and denied outcomes.

Authoritative route handlers and runtime adapters compose these gates and fail closed when required context is missing or invalid. Trusted-internal runtime paths must use explicit `propagate-caller` or `system-action` semantics. Node/service operations require certificate-bound transport identity; payload identity alone is never authoritative.

## Consequences

- Authentication: login/session success is necessary but not sufficient for protected operations.
- Authorization: centralized guards remain mandatory; route-local role checks are violations.
- Transport trust: HTTPS/WSS/mTLS and scenario-specific trust requirements remain required for non-loopback production paths.
- Auditability: denial/acceptance classification and redacted security telemetry become required architecture.
- Runtime/service interaction: async internal calls and node/service channels require explicit trusted-internal or certificate-bound identity semantics.
- High-risk implication: collapsing authentication, trust, and authorization into one step can silently elevate privileges across desktop/thin-client/node paths.
- High-risk implication: long-lived channels must revalidate or invalidate when trust changes to prevent stale authorized access.
- Tradeoff: stricter gate separation adds integration work for new routes and runtime features.

## Review Expectations

- Risk Class: security and trust boundaries (authentication, trust evaluation, authorization, and transport trust sequencing).
- Required Reviewers:
  - Platform architecture owner.
  - Security/trust domain owner.
- Broader Architecture Review Trigger: required before acceptance or supersession if trust-gate ordering changes, transport trust assumptions are relaxed, or privileged internal/runtime bypass paths are introduced.
- Recertification Cadence: re-review this ADR every 6 months or whenever security boundary contracts are materially changed.

## Related Documentation

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/architecture/auth-only-server-startup-contract.ai.md`
- `docs/architecture/authorization-enforcement-integration-patterns.ai.md`
- `docs/architecture/authorization-foundation.ai.md`
- `docs/architecture/trusted-device-foundation.ai.md`
- `docs/architecture/node-trust-foundation.ai.md`
- `docs/architecture/transport-security-foundation.ai.md`
- `docs/architecture/secrets-redaction-and-logging-safeguards.ai.md`
- `docs/context/packs/identity-and-security.pack.ai.md`
- `docs/context/context-map.ai.md`

## Related Code Paths

- `src/application/identity/services/IdentityAuthenticatedSessionService.ts`
- `src/application/identity/services/TrustedDeviceSessionTrustService.ts`
- `src/application/security/use-cases/ValidateTransportConnectionTrustUseCase.ts`
- `src/application/security/use-cases/AuthorizeNodePeerCommunicationUseCase.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/NodeMutualTlsTransportAdapter.ts`
- `src/infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `src/infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `src/infrastructure/security/TransportSecurityObservabilityReporter.ts`
- `src/infrastructure/api/system-runtime/RuntimeRequestRouter.ts`

## Follow-Up Actions

- Use this ADR as a review gate for new security-sensitive routes, async runtime flows, and service channels.
- Add regression tests when trust-context shape, authorization targets, or transport trust scenario mapping changes.
- Keep security architecture references linked back to this ADR under `## Related ADRs` when boundary contracts evolve.
