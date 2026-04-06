# AI Companion: Trusted Device Foundation

## Purpose

Quick implementation-truth baseline for trusted-device domain/contracts introduced in Feature 2 / Epic 2.1.

Session trust integration note:
- runtime session contracts now use structured `deviceTrust` context (trusted device id, assurance level, trust snapshot, invalidation reasons) with legacy `trustedDeviceBindingId` / `trustMarker` compatibility fields preserved.
- runtime host now wires trusted-device-backed session trust evaluation for issuance/validation (`TrustedDeviceSessionTrustService`) so session trust reflects current trusted-device state.
- trust-denied runtime validation now invalidates active sessions and token material immediately, and trust failure metadata is surfaced for observability/user handling.
- trusted session markers are now bound to trusted-device material metadata so stale or mismatched trust material can deterministically invalidate sessions.

## Canonical files

- `src/domain/identity/TrustedDeviceDomain.ts`
- `src/domain/identity/TrustedDevicePairingDomain.ts`
- `application/contracts/IdentityApplicationContracts.ts`
- `application/identity/ports/ITrustedDeviceRepository.ts`
- `application/identity/ports/ITrustedDeviceManagementService.ts`
- `application/identity/ports/ITrustedDevicePairingRepository.ts`
- `application/identity/ports/ITrustedDevicePairingService.ts`
- `application/identity/services/TrustedDeviceManagementService.ts`
- `application/identity/services/TrustedDevicePairingService.ts`
- `application/identity/services/TrustedDeviceServiceMappers.ts`
- `src/application/identity/use-cases/CompleteTrustedDevicePairingUseCase.ts`
- `src/infrastructure/persistence/identity/SqliteTrustedDevicePersistenceAdapter.ts`
- `src/infrastructure/persistence/identity/TrustedDevicePersistenceMapper.ts`
- `src/infrastructure/persistence/identity/SqliteTrustedDevicePersistenceAdapter.ts`
- `src/infrastructure/persistence/identity/TrustedDevicePersistenceMapper.ts`

## Core model

- Entity: `TrustedDevice`
- Value objects: `DeviceDisplayName`, `DeviceFingerprint`, `DeviceTrustMaterialRef`
- Status enum: `DeviceTrustStatuses` (`pending-pairing`, `trusted`, `revoked`, `expired`)
- Pairing enum: `DevicePairingMethods`
- Revocation enum: `DeviceRevocationReasons`
- Pairing token entity: `PairingToken` (`issued`, `consumed`, `expired`, `invalidated`)
- Pairing session entity: `PairingSession` (`initiated`, `validated`, `completed`, `expired`, `invalidated`, `rejected`)

## Lifecycle and invariants

- Transitions are explicit in `TrustedDeviceLifecycleTransitions`.
- Transitions are explicit in `PairingTokenLifecycleTransitions` and `PairingSessionLifecycleTransitions`.
- `trusted` requires `pairedAt` + `trustMaterialRef`.
- `revoked` requires structured revocation metadata.
- `pairedAt`/`lastSeenAt` cannot predate `registeredAt`.
- revoked devices cannot be marked seen.
- pairing tokens are single-use by design (`consumePairingToken(...)` only from `issued`).
- pairing tokens are expirable (`expiresAt`) and attempt-bounded (`failedValidationAttempts` + `maxValidationAttempts`).
- token invalidation carries structured reason metadata; invalid/reused tokens map to explicit validation outcomes.
- pairing session completion requires a consumed token bound to the same session.
- completion can carry pinned trust-material registration metadata (`materialKind`, `pinReference`, optional key fingerprint).

## Application seams

Repository lifecycle contract (`ITrustedDeviceRepository`):
- create
- fetch by id
- fetch by fingerprint
- list
- update
- revoke

Service lifecycle contract (`ITrustedDeviceManagementService`):
- register
- fetch by id
- list
- pair
- update display name
- record last seen
- revoke

Pairing repository lifecycle contract (`ITrustedDevicePairingRepository`):
- create session/token
- fetch session/token
- update session/token
- invalidate pairing artifacts

Pairing service lifecycle contract (`ITrustedDevicePairingService`):
- initiate pairing
- validate pairing token
- complete pairing
- expire pairing attempts/tokens/sessions
- invalidate pairing artifacts

## Completion enforcement update (Story 2.2.2)

- Pairing completion is now implemented as production application service orchestration in `TrustedDevicePairingService`.
- Completion flow now:
  - verifies token/session/device/user/workspace linkage before mutation,
  - validates presented pairing artifact by hash comparison (raw token not persisted),
  - rejects/invalidates invalid completion artifacts,
  - expires issued artifacts that crossed `expiresAt` before completion,
  - consumes token and marks session completed with trust-material registration metadata,
  - pairs the trusted-device record with persisted trust material reference.
- Completion is idempotency-guarded:
  - repeated completion for an already completed session returns persisted state when token + trust material align,
  - conflicting repeated completion requests fail closed.
- Optional completion-time device registration seam:
  - `TrustedDevicePairingCompletionRequest.trustedDeviceRegistration` allows creation of the pending trusted-device record when needed before pairing.
- Sensitive pairing artifacts:
  - service errors avoid echoing presented token values,
  - auth redaction now includes `presentedToken` and `pinReference` keys for transport/log safety.

## Persistence update (Story 2.1.3)

- SQLite migrations for trusted-device/session persistence now land in schema version `6` for both migration tracks:
  - `infrastructure/filesystem/identity/SqliteIdentityMigrations.ts`
  - `src/infrastructure/persistence/identity/SqliteIdentityPersistenceMigrations.ts`
- New tables:
  - `identity_trusted_devices`
  - `identity_trusted_device_pairing_sessions`
  - `identity_trusted_device_pairing_tokens`
- New constraints/index posture:
  - user/workspace/fingerprint uniqueness for trusted devices
  - one pairing token per session + unique token hash
  - status/expiry indexes for pairing token/session expiration sweeps
  - trust-status/update indexes for trusted-device listing/admin flows
- Repository adapter behavior now covers:
  - create/query/update trusted devices
  - trusted-device revocation contract semantics (`invalidRequest`/`notFound`/`invalidState`)
  - create/query/update pairing session and token records
  - pairing-artifact invalidation with deterministic state transition handling

## Tests in this slice

- `src/domain/identity/tests/TrustedDeviceDomain.test.ts`
- `src/domain/identity/tests/TrustedDevicePairingDomain.test.ts`
- `application/contracts/tests/IdentityApplicationContracts.test.ts`
- `application/identity/tests/IdentityPortsContracts.test.ts`
- `src/infrastructure/persistence/identity/tests/TrustedDevicePersistenceMapper.test.ts`
- `src/infrastructure/persistence/identity/tests/SqliteTrustedDevicePersistenceAdapter.test.ts`
- `src/infrastructure/persistence/identity/tests/SqliteTrustedDevicePersistenceAdapter.test.ts`
- `application/identity/tests/TrustedDevicePairingService.test.ts`
- `application/identity/tests/CompleteTrustedDevicePairingUseCase.test.ts`
- `infrastructure/filesystem/identity/tests/TrustedDevicePairingCompletionIntegration.test.ts`

## Audit coverage update (story 2.3.4)

- Trusted-device lifecycle events now emit through the identity lifecycle event publisher abstraction (best-effort, non-blocking).
- New lifecycle event types cover:
  - pairing initiated,
  - pairing completed,
  - pairing failed (`expired`, `invalid-token`),
  - trusted-device revoked,
  - trusted-device trust-status changed.
- Event payloads include actor/target linkage where available (`userIdentityId`, `trustedDeviceId`, `pairingSessionId`, `pairingTokenId`, optional workspace and actor metadata).
- Sensitive pairing material remains excluded from audit payloads:
  - raw pairing artifact/token values are never emitted,
  - trust pin/token secrets are not persisted in lifecycle audit payloads.
- Identity server host now wires a SQLite-backed lifecycle event publisher by default (`SqliteIdentityLifecycleEventPublisher`) so these events are durably recorded without coupling trusted-device services to a specific storage implementation.
