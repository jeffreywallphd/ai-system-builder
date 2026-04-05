# Trusted Device Foundation

This note documents the trusted-device domain and application contract foundation introduced for Feature 2 / Epic 2.1.

Scope in this story is intentionally inner-layer only:
- domain model and lifecycle invariants,
- application repository/service ports,
- shared trusted-device contracts for downstream adapters and UI.

No storage adapter, API route, or UI workflow is introduced in this slice.

## Implemented canonical artifacts

### Domain

- `src/domain/identity/TrustedDeviceDomain.ts`

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

### Application contracts and ports

- Shared contracts: `application/contracts/IdentityApplicationContracts.ts`
- Repository port: `application/identity/ports/ITrustedDeviceRepository.ts`
- Service port: `application/identity/ports/ITrustedDeviceManagementService.ts`

Trusted-device contract coverage now includes:
- record projection type (`TrustedDeviceRecord`),
- list/fingerprint query contracts,
- lifecycle request contracts for register/pair/display-name update/last-seen update/revoke,
- id namespace extension (`IdentityIdNamespaces.trustedDevice`).

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

This aligns with existing identity session trust seams (`trustedDeviceBindingId` / `trustMarker`) without coupling trusted-device domain logic to transport or persistence details.

## Boundary and dependency posture

- Domain remains framework/storage agnostic.
- Application layer declares ports and shared contracts only.
- No infrastructure logic leaks into domain/application trusted-device artifacts.

## Test coverage in this story

- Domain invariants + lifecycle transitions:
  - `src/domain/identity/tests/TrustedDeviceDomain.test.ts`
- Application contract and port compile/lifecycle coverage:
  - `application/contracts/tests/IdentityApplicationContracts.test.ts`
  - `application/identity/tests/IdentityPortsContracts.test.ts`
