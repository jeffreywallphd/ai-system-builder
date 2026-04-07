# AI Companion: Authoritative Audit Recording Service and Ports

## Purpose

Story 18.1.3 introduces an application-layer authoritative audit recording service so audited features can emit canonical events through one reusable port instead of per-feature ad hoc sinks.
Story 18.1.5 wires this service into baseline high-risk security flows.

## Canonical files

- `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
- `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `src/infrastructure/audit/AuthoritativeIdentityLifecycleEventPublisher.ts`
- `src/infrastructure/audit/AuthoritativeNodeTrustAuditSink.ts`
- `src/infrastructure/audit/AuthoritativeAuthorizationPolicyEventRecorder.ts`
- `src/infrastructure/audit/AuditFanoutPublishers.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `docs/architecture/audit-authoritative-recording-service-and-ports.md`

## What was added

- `AuthoritativeAuditRecordingPort` with explicit feature methods:
  - `recordIdentityEvent`
  - `recordNodeTrustEvent`
  - `recordSharingEvent`
  - `recordStorageEvent`
  - `recordRunsEvent`
  - `recordSchedulingEvent`
  - `recordSecretsEvent`
  - `recordPolicyEvent`
- shared `AuthoritativeAuditRecordEventInput` contract for structured payload recording
- reusable feature-recorder helper: `createAuthoritativeAuditFeatureRecorder(...)`
- baseline adapters that map identity lifecycle, node trust, and authorization mutation events into authoritative audit records

## Service behavior

`AuthoritativeAuditRecordingService` now:

- validates action-prefix expectations by source method
- normalizes operation/action values
- resolves canonical category from audit taxonomy
- centralizes payload sanitization and sensitive-key redaction
- computes protected-data/redaction metadata consistently
- creates canonical events and appends through `IAuditLedgerRepository`

Story 18.1.5 composition/wiring now:

- fans out identity lifecycle publishing to legacy lifecycle storage plus authoritative audit recording
- fans out node trust audit sink publishing to legacy node-trust audit storage plus authoritative audit recording
- wires authorization policy mutation recorder to authoritative sharing/permission audit recording
- keeps emission at application use-case/service boundaries

## Why this matters

- Audit recording is now a reusable application capability.
- Feature code can call one authoritative service boundary.
- Redaction and normalization are no longer duplicated in each feature hook.

## Test coverage

- service append behavior and canonical mapping
- centralized redaction + protected-data reason assignment
- cross-feature recorder usage examples
- source/action mismatch guardrails
- adapter integration tests for identity auth/session, trusted-device lifecycle, node trust, and authorization sharing/permission mutation recording
