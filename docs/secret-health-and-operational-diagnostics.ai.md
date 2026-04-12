# AI Companion: Secret Health and Operational Diagnostics

## Purpose

Story 8.3.5 baseline for Feature 8 / Epic 8.3: add production-safe secret service health and diagnostics surfaces so operators can detect misconfiguration without exposing secret material.

## Canonical files

- `src/infrastructure/security/secrets/SecretServiceOperationalDiagnostics.ts`
- `src/infrastructure/api/security/SecretMetadataBackendApi.ts`
- `src/infrastructure/api/security/sdk/PublicSecretMetadataApiContract.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/security/secrets/tests/SecretServiceOperationalDiagnostics.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerSecretMetadata.test.ts`

## Endpoint posture

- General health: `GET /api/v1/security/secrets/health` (authenticated session).
- Detailed diagnostics: `GET /api/v1/security/secrets/diagnostics` (authenticated trusted session).

General health intentionally returns state + flags only. Detailed diagnostics adds top-level service diagnostics plus required-secret IDs and bootstrap diagnostics codes/messages/severities.

Detailed diagnostics now also expose `bootstrap.materialMetadata`: metadata-only provider-material descriptors (identity, scope, backend, timestamps, rotation posture, policy flags, and reference metadata) for required bootstrap secrets that resolved successfully.

Detailed diagnostics now also expose `securityMaterial` entries for governed required material, including classification (`materialId`, category, scope, rotation posture, usage contexts), lifecycle policy (`startupRequirement`, durability class, fallback policy), presence/backend/rotation status, and per-material validation failures/warnings with aggregate summary counts (`healthy`, `degraded`, `missing`, `non-compliant`).

## Safety posture

- No plaintext values.
- No encrypted payload refs, key material, or secret-store locators.
- Diagnostic message sanitization still applies through existing secret error redaction safeguards.
- `bootstrap.materialMetadata` remains metadata-only and does not include `rawValue` or decrypted payload fields.
- `securityMaterial` diagnostics are metadata/governance only and do not include plaintext or decrypted payload fields.

## Health signals

- `healthy`: repository reachable + encryption material configured + required bootstrap secrets usable.
- `degraded`: repository reachable but encryption/required-secret posture is not fully ready.
- `unhealthy`: repository health probe failed.

Health flags:

- `encryptionMaterialAvailable`
- `repositoryReachable`
- `bootstrapSecretsHealthy`
- `runtimeDependenciesHealthy`

## Operations guidance

- `secret-repository-unreachable`: fix persistence adapter/database health first.
- `secret-encryption-unavailable`: configure `AI_LOOM_SECRET_MASTER_KEY_ID` + `AI_LOOM_SECRET_MASTER_KEY`.
- bootstrap diagnostics (`required-secret-missing`, `required-secret-unusable`, etc.): reconcile declared required secret IDs and runtime retrieval viability.
- `optional-secret-missing`/`optional-secret-unusable`: indicates degraded optional lifecycle material; review fallback/development posture before promoting to production.
