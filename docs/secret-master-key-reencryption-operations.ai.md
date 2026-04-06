# AI Companion: Secret Master-Key Re-encryption Operations

## Purpose

Story 8.3.6 baseline for Feature 8 / Epic 8.3: controlled, restartable re-encryption of active secret versions when KEK/master-key material changes.

## Canonical files

- `src/application/security/use-cases/ReEncryptSecretsUseCase.ts`
- `src/application/security/ports/SecretServicePorts.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceAdapter.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceMigrations.ts`
- `infrastructure/api/security/SecretMetadataBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `docs/secret-master-key-reencryption-operations.md`

## Behavior summary

- Administrative workflow enumerates currently active secret versions and re-encrypts each payload under the active key provider configuration.
- Operation state is persisted with target manifest + progress counters + failure details.
- Operation can be resumed by `operationId` and continues from the persisted cursor.

## Safety posture

- Failures are durable and visible: operation status transitions to `failed` with `lastErrorCode`/`lastErrorMessage`.
- Partial progress is retained and recoverable.
- Optimistic revision checks prevent unsafe concurrent status mutation races.
- Audit and observability events are emitted without exposing plaintext.

## API surfaces

- `POST /api/v1/security/secrets/maintenance/re-encryption`
- `GET /api/v1/security/secrets/maintenance/re-encryption/:operationId`

Both routes require authenticated trusted sessions on the identity HTTP server.
