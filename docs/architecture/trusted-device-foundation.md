# Trusted Device Foundation

This note documents the trusted-device domain and application contract foundation introduced for Feature 2 / Epic 2.1.

Scope in this story is intentionally inner-layer only:
- domain model and lifecycle invariants,
- application repository/service ports,
- shared trusted-device contracts for downstream adapters and UI.
- pairing token/session lifecycle contracts for explicit trusted-device enrollment.

No storage adapter, API route, or UI workflow is introduced in this slice.

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
  - `src/domain/identity/tests/TrustedDevicePairingDomain.test.ts`
- Application contract and port compile/lifecycle coverage:
  - `application/contracts/tests/IdentityApplicationContracts.test.ts`
  - `application/identity/tests/IdentityPortsContracts.test.ts`
