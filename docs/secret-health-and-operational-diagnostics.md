# Secret Health and Operational Diagnostics

This note documents Story 8.3.5 (Feature 8 / Epic 8.3): operational diagnostics for secret-service runtime health and administrator troubleshooting.

## Canonical artifacts

- `src/infrastructure/security/secrets/SecretServiceOperationalDiagnostics.ts`
- `src/infrastructure/api/security/SecretMetadataBackendApi.ts`
- `src/infrastructure/api/security/sdk/PublicSecretMetadataApiContract.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/security/secrets/tests/SecretServiceOperationalDiagnostics.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerSecretMetadata.test.ts`

## Runtime endpoints

- General health (authenticated): `GET /api/v1/security/secrets/health`
- Detailed diagnostics (authenticated trusted-session required): `GET /api/v1/security/secrets/diagnostics`

Both endpoints are metadata-only and never expose plaintext values, ciphertext payloads, key material, encrypted payload references, or filesystem secret-store locators.

## Health model

`state` values:

- `healthy`: repository checks pass, encryption material is configured, and required bootstrap secrets are usable.
- `degraded`: service is reachable but one or more operational requirements are not satisfied (for example encryption unconfigured or required bootstrap secret missing).
- `unhealthy`: core repository health checks fail.

`healthFlags`:

- `encryptionMaterialAvailable`: envelope-encryption material is configured for secret writes/rotations.
- `repositoryReachable`: metadata repository read path is functioning.
- `bootstrapSecretsHealthy`: required bootstrap system secrets are present and runtime-usable.
- `runtimeDependenciesHealthy`: effective runtime secret dependency posture (`encryptionMaterialAvailable && bootstrapSecretsHealthy`).

## Detailed diagnostics interpretation

Detailed diagnostics include:

- `diagnostics[]`: overall service findings (for example repository or encryption posture)
- `bootstrap.requiredSecretIds`
- `bootstrap.diagnostics[]`
- `bootstrap.materialMetadata[]`: metadata-only provider-material descriptors for required bootstrap secrets that resolved successfully (identity/scope/backend/timestamps/rotation/policy/reference metadata)

All diagnostic entries contain code/severity/message/secretId only. `bootstrap.materialMetadata[]` remains metadata-only and excludes raw secret/decrypted value fields.

Common diagnostic codes:

- `required-secret-missing`: required bootstrap secret does not exist.
- `required-secret-unusable`: secret exists but runtime retrieval/consumption failed.
- `unsupported-required-secret`: configured required id is not registered for bootstrap.
- `legacy-migration-unavailable`: migration path unavailable during validation posture.
- `legacy-migration-failed`: migration attempt failed.
- `secret-encryption-unavailable`: encryption key material is not configured.
- `secret-repository-unreachable`: repository metadata health probe failed.

Operator guidance:

1. If `repositoryReachable=false`, treat as `unhealthy` and restore persistence/adapter health first.
2. If `encryptionMaterialAvailable=false`, configure `AI_LOOM_SECRET_MASTER_KEY_ID` and `AI_LOOM_SECRET_MASTER_KEY`.
3. If `bootstrapSecretsHealthy=false`, reconcile missing/unusable required secret IDs from `bootstrap.requiredSecretIds` and diagnostics codes.
4. Recheck `GET /api/v1/security/secrets/health` after remediation; promote to `healthy` before relying on secret-dependent runtime services.
