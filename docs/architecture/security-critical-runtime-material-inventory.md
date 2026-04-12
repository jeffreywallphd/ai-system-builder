---
title: Security-Critical Runtime Material Inventory
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-12
related_code_paths:
  - src/hosts/server
  - src/infrastructure/security
  - src/application/security
  - src/infrastructure/transport/http-server/identity
---

# Security-Critical Runtime Material Inventory

Feature: 3  
Epic: 3.4  
Story: 3.4.4

## Purpose

Document the hardened security-material model used by authoritative startup, runtime secret resolution, and diagnostics so operators and contributors can configure, bootstrap, rotate, and extend secret handling safely.

## Required Material Classes

| Material Class | Scope | Runtime Examples | Startup Policy Model |
| --- | --- | --- | --- |
| Provider credentials | `server`, `workspace`, `user` | `secret:server:provider:openai`, `secret:server:provider:huggingface` | Server required material is fail-fast in production; workspace/user material is resolved by scoped runtime flows. |
| Server signing material | `server` | `secret:server:signing:identity-session`, `secret:server:image-upload-session-token` | Fail-fast in production; identity-session signing can be optional/ephemeral in development policy. |
| Encryption key material | `server`, `storage-instance` | `secret:server:asset-content-encryption-key`, `AI_LOOM_SECRET_MASTER_KEY_ID` + `AI_LOOM_SECRET_MASTER_KEY` | Envelope/config keys are required for durable encrypted secret storage and re-encryption paths. |
| Certificate and transport trust material | `server` | managed TLS private-key material refs, internal CA root material refs | Managed TLS references are required when managed TLS is enabled. |
| Bootstrap governance controls | `server` | `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` | Declares which system secrets must be present and runtime-usable at startup. |

## Startup Configuration Expectations

Production-capable startup (`NODE_ENV=production` or non-development host profile) is expected to provide durable configured material for:

- `AI_LOOM_SECRET_MASTER_KEY_ID` and `AI_LOOM_SECRET_MASTER_KEY` (required together when secret encryption is enabled)
- `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` when enforcing required system secret inventory
- security-critical runtime secret inputs validated by startup policy (`AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET`, `AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY`, `AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET`, `AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET`, `AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET`), including permitted inherited legacy input where explicitly modeled
- managed TLS selector inputs when `AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED=true`

Lifecycle stage is resolved from deployment profile + environment (`production`, `development`, `test`) and drives whether issues are fatal or warning-only.

## Provider Architecture and Scope Resolution

Runtime secret resolution is provider-first and scope-explicit:

1. Callers resolve material via scoped application flows (`ScopedSecretProviderMaterialRetrievalUseCase`) instead of direct env reads.
2. `DefaultSecretProviderResolutionService` routes by owner scope:
   - `server` -> `DurableServerSecretStoreBackend`
   - `workspace` -> managed runtime secret consumption adapters
   - `user` -> optional local secure store backend, then managed user secret flow
3. Consumers receive metadata-only descriptors for diagnostics/admin views; plaintext requires dedicated retrieval flow.

This keeps startup and runtime handling governable across server/workspace/user boundaries.

## Lifecycle and Rotation Behavior

Secret material lifecycle and rotation are explicit in contracts:

- version states include `active`, `previous`, `pending`, `revoked`, `retired`
- rotation metadata carries policy and timeline information
- runtime retrieval defaults to active version; superseded version access requires explicit compatibility intent
- revocation/retirement remove versions from active runtime selection
- asset content encryption key rollover is versioned and read-compatible without automatic bulk re-encryption

## Diagnostics and Readiness Interpretation

Startup and runtime diagnostics are surfaced through:

- startup security-material validation (`AuthoritativeServerSecurityBootstrapStage`)
- secret health endpoint: `GET /api/v1/security/secrets/health`
- trusted diagnostics endpoint: `GET /api/v1/security/secrets/diagnostics`

Key diagnostic state model:

- startup validation issue severities: `fatal` (blocks startup) and `warning`
- material readiness states: `healthy`, `degraded`, `missing`, `non-compliant`
- service health states: `healthy`, `degraded`, `unhealthy`

Diagnostics are metadata-only and redacted; plaintext and key bytes are excluded.

## Development and Test Profile Allowances

Development/test profiles allow governed fallback only when policy explicitly permits it:

- optional material can emit warning diagnostics instead of blocking startup
- deterministic development fallback for critical server material is allowed only when startup validation marks material as policy-eligible generated-ephemeral
- production-capable startup does not permit implicit generated ephemeral fallback for fail-fast-required material

Obsolete random runtime fallback behavior has been removed from critical server token/encryption material resolvers.

## Extension Guide: New Secret Consumers

When adding a new consumer:

1. Define a classification contract with explicit category, scope, lifecycle policy, and hierarchy ownership.
2. Add startup descriptor coverage if material is startup-sensitive.
3. Resolve runtime material through scoped provider retrieval use cases or `ServerPlatformSecretConsumers`.
4. Expose metadata-only diagnostics and preserve redaction/audit behavior.
5. Add tests for production fail-fast and development/test warning behavior.

## Extension Guide: New Provider Backends

When adding a backend:

1. Implement `ISecretProviderMaterialResolutionPort` behavior for target scope(s).
2. Preserve metadata model guarantees (`SecretProviderMaterialMetadata`) and policy flags.
3. Integrate routing into `DefaultSecretProviderResolutionService` without bypassing scope rules.
4. Ensure bootstrap, metadata, existence, and retrieval operations stay auditable and plaintext-safe.
5. Extend diagnostics surfaces to report backend identity without exposing secret material.

## Canonical Code Surfaces

- `src/application/security/contracts/SecurityMaterialClassificationContract.ts`
- `src/application/security/contracts/SecurityMaterialKeyHierarchyContract.ts`
- `src/application/security/contracts/SecurityMaterialRotationContract.ts`
- `src/application/security/services/SecurityMaterialStartupValidationPipeline.ts`
- `src/infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline.ts`
- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- `src/infrastructure/security/secrets/SecretServiceOperationalDiagnostics.ts`
- `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- `src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts`

## Related References

- [Secrets Foundation](./secrets-foundation.md)
- [Secret Bootstrap and Migration Operations](../secret-bootstrap-and-migration-operations.md)
- [Secret Health and Operational Diagnostics](../secret-health-and-operational-diagnostics.md)
- [Secret-Backed Feature Contributor Guide](../secret-backed-feature-contributor-guide.md)
