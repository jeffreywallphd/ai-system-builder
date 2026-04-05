# Trusted Device Foundation

This note documents the trusted-device domain and application contract foundation introduced for Feature 2 / Epic 2.1.

Scope in the initial stories was intentionally inner-layer only:
- domain model and lifecycle invariants,
- application repository/service ports,
- shared trusted-device contracts for downstream adapters and UI.
- pairing token/session lifecycle contracts for explicit trusted-device enrollment.

Story 2.1.3 extends this foundation with infrastructure persistence adapters and schema migrations. API routes and UI pairing flows remain out of scope here.

Story 2.2.3 adds trusted-device-backed session issuance/validation enforcement using this foundation (`TrustedDeviceSessionTrustService`) so runtime session trust is bound to current trusted-device state.
Story 2.2.4 hardens this by invalidating active sessions and token material when trust evaluation fails (revoked/expired/mismatched/stale trust context), and by surfacing explicit trust-failure metadata through auth/session layers.

## Implemented canonical artifacts

### Domain

- `src/domain/identity/TrustedDeviceDomain.ts`
- `src/domain/identity/TrustedDevicePairingDomain.ts`

Canonical domain concepts:
- `TrustedDevice` entity with explicit identity and workspace association.
- Value objects:
  - `DeviceDisplayName`
  - `DeviceFingerprint`
  - `DeviceTrustMaterialRef`
- Enums/constants:
  - `DeviceTrustStatuses`
  - `DevicePairingMethods`
  - `DeviceTrustMaterialKinds`
  - `DeviceRevocationReasons`
- Lifecycle transitions:
  - `TrustedDeviceLifecycleTransitions`
  - `isTrustedDeviceTransitionAllowed(...)`
  - `TrustedDeviceLifecycleTransitionError`

Primary domain operations:
- `createTrustedDevice(...)`
- `pairTrustedDevice(...)`
- `touchTrustedDevice(...)`
- `updateTrustedDeviceDisplayName(...)`
- `revokeTrustedDevice(...)`
- `expireTrustedDevice(...)`
- `createPairingSession(...)`
- `createPairingToken(...)`
- `registerPairingTokenFailedAttempt(...)`
- `consumePairingToken(...)`
- `expirePairingToken(...)`
- `invalidatePairingToken(...)`
- `markPairingSessionValidated(...)`
- `completePairingSession(...)`
- `rejectPairingSession(...)`
- `expirePairingSession(...)`
- `invalidatePairingSession(...)`

### Application contracts and ports

- Shared contracts: `application/contracts/IdentityApplicationContracts.ts`
- Repository port: `application/identity/ports/ITrustedDeviceRepository.ts`
- Service port: `application/identity/ports/ITrustedDeviceManagementService.ts`
- Pairing repository port: `application/identity/ports/ITrustedDevicePairingRepository.ts`
- Pairing service port: `application/identity/ports/ITrustedDevicePairingService.ts`
- Application implementations:
  - `application/identity/services/TrustedDeviceManagementService.ts`
  - `application/identity/services/TrustedDevicePairingService.ts`
  - `application/identity/services/TrustedDeviceServiceMappers.ts`
  - `src/application/identity/use-cases/CompleteTrustedDevicePairingUseCase.ts`

Trusted-device contract coverage now includes:
- record projection type (`TrustedDeviceRecord`),
- list/fingerprint query contracts,
- lifecycle request contracts for register/pair/display-name update/last-seen update/revoke,
- pairing DTOs for initiation/validation/completion/expiration/invalidation flows,
- pairing session/token record contracts with attempt counters and invalidation metadata,
- id namespace extension:
  - `IdentityIdNamespaces.trustedDevice`
  - `IdentityIdNamespaces.trustedDevicePairingSession`
  - `IdentityIdNamespaces.trustedDevicePairingToken`

## Pairing token and session lifecycle model

Pairing token status is explicit:
- `issued`
- `consumed`
- `expired`
- `invalidated`

Pairing session status is explicit:
- `initiated`
- `validated`
- `completed`
- `expired`
- `invalidated`
- `rejected`

Pairing lifecycle rules are modeled in-domain with explicit transition maps:
- `PairingTokenLifecycleTransitions`
- `PairingSessionLifecycleTransitions`

Key invariants and posture:
- pairing tokens are single-use; only `issued` tokens can be consumed.
- pairing tokens are time-bounded; `expiresAt` is required and validated against `issuedAt`.
- failed validation attempts are tracked with explicit counters and limit enforcement.
- attempt-limit exhaustion can auto-invalidate tokens with structured reason metadata.
- invalid/reused/expired token states map to explicit validation outcomes for deterministic use-case handling.
- pairing session completion requires a consumed token linked to the same session.
- completion supports optional pinned trust-material registration metadata (`materialKind`, `pinReference`, optional key fingerprint) so trust-material enrollment can be finalized in later stories without changing use-case contracts.

Story 2.2.2 runtime completion posture:
- pairing completion is now implemented as production application orchestration (not only contract tests).
- completion verifies session/token/device/user/workspace linkage before mutating state.
- completion validates presented pairing artifacts by hash comparison (raw artifact values are not persisted).
- expired, invalidated, or reused artifacts cannot transition a device to trusted.
- invalid completion artifacts invalidate/reject the pairing flow deterministically.
- successful completion consumes the pairing token, completes the pairing session, persists trust-material registration metadata, and persists the trusted device in `trusted` state with `trustMaterialRef`.
- completion is idempotency-guarded for already completed sessions and fails closed on conflicting repeats.
- completion request now supports optional `trustedDeviceRegistration` material to create pending trusted-device records before pairing where needed.

## Trusted-device lifecycle model

Trust status is explicit and non-stringly typed:
- `pending-pairing`
- `trusted`
- `revoked`
- `expired`

Transition policy is explicit via `TrustedDeviceLifecycleTransitions`:
- `pending-pairing` -> `trusted`, `revoked`, `expired`
- `trusted` -> `revoked`, `expired`
- `revoked` -> `pending-pairing`
- `expired` -> `pending-pairing`, `revoked`

State invariants include:
- `trusted` requires both `pairedAt` and `trustMaterialRef`.
- `revoked` requires structured revocation details (reason + timestamp).
- non-revoked devices cannot carry revocation payload.
- `pairedAt` and `lastSeenAt` cannot predate `registeredAt`.
- revoked devices cannot be marked seen.

## Identity and workspace association model

`TrustedDevice` is anchored to identity/session trust semantics through:
- required `userIdentityId`,
- optional `workspaceId` for workspace-aware trust scoping,
- trust material reference and revocation metadata for future evaluator and admin workflows.

This aligns with the session trust model (`deviceTrust` context with trusted device id, assurance level, trust snapshot, and invalidation reasons) while preserving legacy compatibility seams (`trustedDeviceBindingId` / `trustMarker`) without coupling trusted-device domain logic to transport or persistence details.

## Boundary and dependency posture

- Domain remains framework/storage agnostic.
- Application layer declares ports and shared contracts only.
- Infrastructure now provides SQLite-backed adapters for trusted-device and pairing repository ports.
- No persistence-specific concerns leak into domain/application trusted-device artifacts.

## Persistence and migrations (Story 2.1.3)

Primary persistence artifacts:
- `infrastructure/filesystem/identity/SqliteTrustedDeviceRepository.ts`
- `infrastructure/filesystem/identity/TrustedDevicePersistenceMapper.ts`
- `src/infrastructure/persistence/identity/SqliteTrustedDevicePersistenceAdapter.ts`
- `src/infrastructure/persistence/identity/TrustedDevicePersistenceMapper.ts`
- `infrastructure/filesystem/identity/SqliteIdentityMigrations.ts` (schema version 6, with session trust context columns)
- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceMigrations.ts` (schema version 6, with session trust context columns)

New SQLite tables:
- `identity_trusted_devices`
- `identity_trusted_device_pairing_sessions`
- `identity_trusted_device_pairing_tokens`

Persistence guarantees now covered:
- durable trusted-device and pairing artifact storage with explicit status fields.
- uniqueness constraints for user/workspace fingerprint tuples and single token/session bindings.
- deterministic invalidation and revocation state updates with audit-relevant timestamps.
- expiration-oriented indexes for pairing tokens/sessions and trust-status indexes for admin/session workflows.

## Test coverage in this story

- Domain invariants + lifecycle transitions:
  - `src/domain/identity/tests/TrustedDeviceDomain.test.ts`
  - `src/domain/identity/tests/TrustedDevicePairingDomain.test.ts`
- Application contract and port compile/lifecycle coverage:
  - `application/contracts/tests/IdentityApplicationContracts.test.ts`
  - `application/identity/tests/IdentityPortsContracts.test.ts`
- Persistence mapper and adapter coverage:
  - `src/infrastructure/persistence/identity/tests/TrustedDevicePersistenceMapper.test.ts`
  - `src/infrastructure/persistence/identity/tests/SqliteTrustedDevicePersistenceAdapter.test.ts`
  - `infrastructure/filesystem/identity/tests/SqliteTrustedDeviceRepository.test.ts`
- Application/service and completion integration coverage (Story 2.2.2):
  - `application/identity/tests/TrustedDevicePairingService.test.ts`
  - `application/identity/tests/CompleteTrustedDevicePairingUseCase.test.ts`
  - `infrastructure/filesystem/identity/tests/TrustedDevicePairingCompletionIntegration.test.ts`
