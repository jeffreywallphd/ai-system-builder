# Secret Health and Operational Diagnostics

This runbook explains how to interpret secret health and diagnostics under the hardened security-material model.

## Canonical artifacts

- `src/infrastructure/security/secrets/SecretServiceOperationalDiagnostics.ts`
- `src/infrastructure/api/security/SecretMetadataBackendApi.ts`
- `src/infrastructure/api/security/sdk/PublicSecretMetadataApiContract.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/shared/dto/security/SecretServiceOperationalDiagnosticsDtos.ts`
- `src/infrastructure/security/secrets/tests/SecretServiceOperationalDiagnostics.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerSecretMetadata.test.ts`

## Endpoint access model

- `GET /api/v1/security/secrets/health`
  - requires authenticated session
  - returns high-level state and health flags
- `GET /api/v1/security/secrets/diagnostics`
  - requires authenticated trusted session (`require-trusted`)
  - returns detailed diagnostics, bootstrap metadata, and security-material entries

Both are metadata-only surfaces; plaintext/ciphertext/key bytes are not returned.

## Service health model

`state`:

- `healthy`: repository reachable, encryption configured, required bootstrap secrets healthy
- `degraded`: repository reachable but encryption/bootstrap posture is incomplete
- `unhealthy`: repository health probe failed

`healthFlags`:

- `encryptionMaterialAvailable`
- `repositoryReachable`
- `bootstrapSecretsHealthy`
- `runtimeDependenciesHealthy`

## Security material diagnostics model

Detailed diagnostics include `securityMaterial` with:

- lifecycle stage: `production`, `development`, or `test`
- summary counts: `healthy`, `degraded`, `missing`, `nonCompliant`
- per-secret entries containing:
  - classification (`materialId`, category, scope, rotation posture, usage contexts)
  - policy (`startupRequirement`, `durabilityClass`, `fallbackPolicy`)
  - provider/backend metadata and rotation status
  - validation failures and warnings
  - `fallbackModeActive` signal when optional fallback policy is active

Per-entry state interpretation:

- `healthy`: present and policy-compliant with no warnings/failures
- `degraded`: present but warning/fallback/degraded policy condition exists
- `missing`: expected material metadata not present
- `non-compliant`: policy/fail-fast validation failure

## Common diagnostic codes and actions

- `secret-repository-unreachable`
  - restore repository/persistence health first
- `secret-encryption-unavailable`
  - configure `AI_LOOM_SECRET_MASTER_KEY_ID` + `AI_LOOM_SECRET_MASTER_KEY`
- `required-secret-missing` or `required-secret-unusable`
  - reconcile `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` with durable secret records and runtime retrieval
- `unsupported-required-secret`
  - remove invalid required id or add proper registered definition
- `legacy-migration-unavailable` / `legacy-migration-failed`
  - ensure migration prerequisites or complete explicit manual bootstrap
- `optional-secret-missing` / `optional-secret-unusable`
  - acceptable only in non-production lifecycle policy; review before production promotion

## Operator triage sequence

1. Check `/health` for overall state and flags.
2. If degraded/unhealthy, query `/diagnostics` from a trusted session.
3. Resolve repository and encryption prerequisites first.
4. Resolve required bootstrap secret issues next.
5. Re-run health/diagnostics and confirm `runtimeDependenciesHealthy=true` before production traffic.

## Governance and audit safety

- diagnostics include `bootstrap.materialMetadata` and `securityMaterial.entries` for governance visibility
- diagnostics are safe for admin/operator use (metadata-only)
- retrieval/bootstrap/mutation paths emit auditable events with redaction safeguards
