# Authoritative Audit Recording Service and Ports

This note captures Story 18.1.3 and Story 18.1.5 for Feature 18 / Epic 18.1.

## Scope

Implemented in this slice:

- application-layer authoritative audit recording service under `src/application/audit/use-cases`
- feature-oriented application audit recording ports under `src/application/audit/ports`
- central normalization and redaction logic before canonical audit persistence
- tests validating service behavior and cross-feature emission examples

Out of scope in this slice:

- migration of all existing feature-specific audit sinks to this service
- durable infrastructure repository/schema changes for the canonical ledger
- transport/UI query endpoint integration for audit review

Story 18.1.5 extends this with baseline production wiring for high-risk security events:

- identity authentication/session lifecycle events (login success/failure, session create/logout/trust invalidation)
- trusted-device pairing and revocation lifecycle events
- node trust approval/revocation and related trust-administration mutation events
- authorization sharing/permission mutation events

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

## Port surface

`AuthoritativeAuditRecordingPort` exposes feature-oriented methods so application code can emit authoritative events from:

- identity
- node trust
- sharing
- storage
- runs
- scheduling
- secrets
- policy

Each method accepts `AuthoritativeAuditRecordEventInput`, which includes:

- mutation context (`operationKey`)
- canonical event identity (`eventType`, `action`, `outcome`, `occurredAt`)
- canonical actor/scope/resource references
- structured payload boundaries (`userSafeDetails`, `adminOnlyDetails`, protected-data metadata)
- optional retention/immutability/integrity overrides

## Authoritative service behavior

`AuthoritativeAuditRecordingService` centralizes audit event preprocessing and persistence:

1. validates source-to-action namespace alignment (`source` method + action prefixes)
2. normalizes action and operation keys
3. resolves canonical category from action taxonomy when category is not explicitly provided
4. sanitizes payloads recursively and redacts sensitive fields in one central place
5. sets/augments protected-data posture (`hasProtectedData`, `redactionReasons`)
6. creates canonical immutable audit events (`createCanonicalAuditEvent(...)`)
7. appends through `IAuditLedgerRepository`

## Redaction and normalization posture

The service applies reusable, centralized safeguards for both `userSafeDetails` and `adminOnlyDetails`:

- sensitive key redaction (`secret`, `token`, `credential`, key material, transport/auth details)
- personal-data key redaction (`email`, `phone`, `address`, etc.)
- internal diagnostic key classification for restricted details
- recursive nested-object/array sanitization and string length bounds

This keeps per-feature use cases from hand-rolling divergent redaction behavior.

## Integration examples

Cross-feature code can obtain source-scoped recorders through:

- `createAuthoritativeAuditFeatureRecorder(service, AuthoritativeAuditEventSources.runs)`
- `createAuthoritativeAuditFeatureRecorder(service, AuthoritativeAuditEventSources.policy)`

The shared service then emits canonical records with source-appropriate action namespace enforcement and centralized payload processing.

Story 18.1.5 integration uses application-boundary adapters and host composition fan-out:

- `FanoutIdentityLifecycleEventPublisher` preserves existing lifecycle event sinks while adding authoritative identity recording.
- `FanoutNodeTrustAuditSink` preserves existing node-trust audit sinks while adding authoritative node-trust recording.
- `AuthoritativeAuthorizationPolicyEventRecorder` wires authorization mutation/evaluation recorder output into authoritative sharing/permission audit workflows.
- Emission remains in application services/use cases, not transport/UI controllers.

## Tests

`src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts` covers:

- category/action/operation normalization
- centralized redaction and protected-data metadata behavior
- cross-feature recorder integration (`runs`, `policy`) through one service
- source/action mismatch rejection
- immutable-safe canonical event snapshot helper behavior

`src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts` covers:

- identity lifecycle adapter emission into authoritative audit records
- node trust adapter emission for approval/revocation-style events with sensitive-field redaction
- authorization mutation adapter emission for sharing/permission changes with redaction-safe admin payload boundaries
