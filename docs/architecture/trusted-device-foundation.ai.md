# AI Companion: Trusted Device Foundation

## Purpose

Quick implementation-truth baseline for trusted-device domain/contracts introduced in Feature 2 / Epic 2.1.

## Canonical files

- `src/domain/identity/TrustedDeviceDomain.ts`
- `src/domain/identity/TrustedDevicePairingDomain.ts`
- `application/contracts/IdentityApplicationContracts.ts`
- `application/identity/ports/ITrustedDeviceRepository.ts`
- `application/identity/ports/ITrustedDeviceManagementService.ts`
- `application/identity/ports/ITrustedDevicePairingRepository.ts`
- `application/identity/ports/ITrustedDevicePairingService.ts`

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

## Tests in this slice

- `src/domain/identity/tests/TrustedDeviceDomain.test.ts`
- `src/domain/identity/tests/TrustedDevicePairingDomain.test.ts`
- `application/contracts/tests/IdentityApplicationContracts.test.ts`
- `application/identity/tests/IdentityPortsContracts.test.ts`
