# Secret Rotation and Version Activation Workflows

This note documents Story 8.3.1 (Feature 8 / Epic 8.3): production-grade secret rotation with versioned activation and race-safe persistence semantics.

## Canonical artifacts

- `src/application/security/use-cases/RotateSecretUseCase.ts`
- `src/application/security/ports/SecretServicePorts.ts`
- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceAdapter.ts`
- `src/application/security/tests/RotateSecretUseCase.test.ts`

## Rotation semantics

- Rotation creates a new encrypted secret version and activates it as the current version on success.
- When a prior active version exists, it is marked `superseded` and linked through `supersededByVersionId`.
- If no active version exists (legacy/incomplete records), rotation creates the first active version (`v1`) without requiring plaintext backfill from prior versions.
- Secret retrieval for runtime always resolves only the active version (`currentVersionId`) and never returns prior version plaintext.

## Controlled activation and race-safe behavior

- `RotateSecretRequest` now supports an optional `expectedCurrentVersionId` precondition.
- Rotation persistence uses `saveSecretWhenCurrentVersionMatches(...)` when available.
- The SQLite adapter implements conditional save behavior that only writes when the persisted `currentVersionId` still matches the expected value.
- If the expectation fails, rotation returns `secret-conflict` and does not overwrite the concurrently activated version.
- Where conditional save is unavailable, rotation falls back to standard `saveSecret(...)` for compatibility.

## Failure and rollback posture

- Encryption and domain validation happen before persistence.
- If persistence fails after encryption, rotation returns `secret-internal`.
- Persisted secret state remains unchanged on failed conditional save or failed persistence write.
- Operation and access audit events still record outcome, reason codes, and actor attribution without plaintext leakage.

## Version metadata and lineage posture

- Prior versions remain persisted for lineage/audit metadata (version number/state/lineage ids/digests/context references).
- Metadata-only projections continue to expose `SecretReference` and never encrypted payload internals or plaintext.

## Test coverage

`RotateSecretUseCase.test.ts` covers:

- first-version activation when rotating a legacy record with no current version
- repeated rotation with lineage preservation and active-only runtime retrieval
- concurrent activation conflict behavior using conditional version matching
- persistence failure rollback behavior that preserves the prior active version
