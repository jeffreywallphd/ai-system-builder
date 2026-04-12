# AI Companion: Secret Rotation and Version Activation Workflows

## Purpose

Quick baseline for Story 8.3.1 (Feature 8 / Epic 8.3): implement rotation workflows that safely create new versions, activate them, and preserve audit lineage without leaking plaintext.

## Canonical files

- `src/application/security/use-cases/RotateSecretUseCase.ts`
- `src/application/security/ports/SecretServicePorts.ts`
- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceAdapter.ts`
- `src/application/security/tests/RotateSecretUseCase.test.ts`
- `docs/architecture/secrets-rotation-and-version-activation-workflows.md`

## Behavior summary

- Rotation creates and encrypts a new version, then activates it as `currentVersionId`.
- Prior active versions are retained and marked `superseded` with lineage links.
- Legacy records missing active versions can still rotate, producing first active version `v1`.
- Runtime plaintext retrieval continues to resolve only the active version.

## Concurrency and activation controls

- `RotateSecretRequest.expectedCurrentVersionId` supports operator-supplied precondition checks.
- Rotation uses conditional save (`saveSecretWhenCurrentVersionMatches`) when the repository provides it.
- SQLite persistence implements this conditional save and rejects stale activation attempts.
- Concurrent/stale activation attempts return `secret-conflict` instead of clobbering newer active versions.

## Failure posture

- Persistence failures return `secret-internal`.
- On conditional conflict or persistence failure, stored secret versions/currentVersion remain unchanged.
- Audit and operation events continue to capture actor + outcome while remaining plaintext-safe.

## Test posture

`RotateSecretUseCase.test.ts` verifies:

- first version creation by rotation
- repeated rotation and active-only runtime retrieval
- concurrent activation conflict handling
- failure rollback that preserves prior active version
