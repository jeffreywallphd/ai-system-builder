---
title: ADR-005 Trust, Identity, and Security Boundary Enforcement
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 005
decision_status: accepted
decision_date: 2026-04-11
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

AI Loom Studio will enforce a layered security boundary model where identity proof, session trust, authorization, and transport trust are separate decision gates with fail-closed behavior. Authoritative server boundaries remain the only source of truth for protected mutation authorization, trust-state resolution, and audit event classification. Runtime and service interactions must present explicit actor/transport trust context and may not rely on network location, host type, or successful login alone as security authority.

## Context and Problem Statement

The repository now has durable contracts for identity login/session flows, trusted-device trust, node trust, transport trust validation, and policy-based authorization. These contracts are implemented across multiple hosts, APIs, and runtime channels (HTTP, WebSocket, mTLS, async internal routing), so security-sensitive work spans many seams that can drift if assumptions stay implicit.

Without one decision of record for trust and boundary enforcement, contributors can accidentally collapse distinct trust checks ("authenticated" treated as "authorized" or "transport-trusted"), create route-local exceptions, or introduce non-auditable runtime/service shortcuts. This ADR captures the authoritative security boundary posture so future work extends the existing model instead of weakening it through convenience paths.

## Decision Drivers

- Preserve explicit separation between authentication, authorization, and transport/device/node trust.
- Keep deny-by-default behavior and avoid implicit trust inheritance.
- Keep authoritative server routes and use cases as the policy and mutation enforcement boundary.
- Preserve auditable, redaction-safe security decision telemetry across accepted and denied operations.
- Protect runtime and service-to-service channels from identity spoofing and stale trust assumptions.

## Considered Options

1. Layered security boundary model with explicit trust domains and centralized enforcement (accepted): keeps security decisions composable, auditable, and fail-closed across user, device, node, and service paths.
2. Collapsed "single auth gate" model where login/session implies most trust outcomes (rejected): reduces implementation friction but conflates identity proof with authorization and transport trust, increasing privilege escalation and lateral movement risk.
3. Per-route or per-host discretionary security checks (rejected): allows local optimization but fragments policy semantics, increases bypass risk, and makes audit/forensics inconsistent.
4. Perimeter/LAN trust-biased model with selective secure-channel enforcement (rejected): conflicts with existing transport-security contracts and creates high-risk downgrade pathways in mixed host/runtime deployments.

## Chosen Approach

Security-sensitive operations must satisfy four explicit gates at the relevant boundary:

- Authentication gate: identity/session proof establishes actor context but does not grant resource authority.
- Trust gate: trusted-device, node trust, and certificate posture are evaluated for the channel/scenario using transport trust contracts.
- Authorization gate: protected resource or workspace-capability decisions flow through centralized policy evaluators and transport guards.
- Auditability gate: accepted/denied security decisions emit redaction-safe event metadata for operational traceability.

Authoritative route handlers and runtime adapters must compose these gates in order and fail closed when required context is missing or invalid. Trusted-internal runtime interactions remain explicit (`propagate-caller` or `system-action`) and cannot bypass authorization semantics. Node and service interactions require certificate-bound trust posture; payload-claimed identity is never authoritative without transport-bound validation.

## Consequences

- Authentication: login/session establishment is necessary but insufficient for protected operations; session context must remain separate from authorization and transport trust outcomes.
- Authorization: all protected resources must use centralized policy guards/adapters; route-local role checks are treated as architectural violations.
- Transport trust: HTTPS/WSS/mTLS enforcement and scenario-specific trust requirements stay mandatory for non-loopback production paths, with explicit rejection reasons.
- Auditability: security decision logging/audit pipelines become required architecture, including denial classification and redaction controls.
- Runtime/service interaction: async internal routing and node/service calls must carry explicit trusted-internal semantics or certificate-bound identity, preventing implicit "internal network" trust.
- High-risk implication: any bypass that merges authentication, trust, and authorization into one step can create silent privilege escalation across desktop, thin-client, and node channels.
- High-risk implication: stale trust on long-lived channels (for example websocket sessions after revocation) must trigger invalidation/revalidation to avoid unauthorized continuity.
- Tradeoff: stricter separation increases integration effort for new routes and runtime features because each gate must be wired explicitly.

## Related Documentation

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/architecture/auth-only-server-startup-contract.md`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/architecture/authorization-foundation.md`
- `docs/architecture/trusted-device-foundation.md`
- `docs/architecture/node-trust-foundation.md`
- `docs/architecture/transport-security-foundation.md`
- `docs/architecture/secrets-redaction-and-logging-safeguards.md`
- `docs/context/packs/identity-and-security.pack.md`
- `docs/context/context-map.md`

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

- Treat this ADR as a review gate for new security-sensitive routes, async runtime flows, and service-to-service channels.
- Add regression tests when new surfaces change trust-context shape, authorization targets, or transport trust scenario mapping.
- Keep security architecture references updated with `## Related ADRs` backlinks to this record when boundary contracts evolve.
