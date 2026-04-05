# AI Companion: Trusted Device Foundation

## Purpose

Quick implementation-truth baseline for trusted-device domain/contracts introduced in Feature 2 / Epic 2.1.

## Canonical files

- `src/domain/identity/TrustedDeviceDomain.ts`
- `application/contracts/IdentityApplicationContracts.ts`
- `application/identity/ports/ITrustedDeviceRepository.ts`
- `application/identity/ports/ITrustedDeviceManagementService.ts`

## Core model

- Entity: `TrustedDevice`
- Value objects: `DeviceDisplayName`, `DeviceFingerprint`, `DeviceTrustMaterialRef`
- Status enum: `DeviceTrustStatuses` (`pending-pairing`, `trusted`, `revoked`, `expired`)
- Pairing enum: `DevicePairingMethods`
- Revocation enum: `DeviceRevocationReasons`

## Lifecycle and invariants

- Transitions are explicit in `TrustedDeviceLifecycleTransitions`.
- `trusted` requires `pairedAt` + `trustMaterialRef`.
- `revoked` requires structured revocation metadata.
- `pairedAt`/`lastSeenAt` cannot predate `registeredAt`.
- revoked devices cannot be marked seen.

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

## Tests in this slice

- `src/domain/identity/tests/TrustedDeviceDomain.test.ts`
- `application/contracts/tests/IdentityApplicationContracts.test.ts`
- `application/identity/tests/IdentityPortsContracts.test.ts`
