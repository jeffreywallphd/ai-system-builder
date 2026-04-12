# AI Companion: Security-Critical Runtime Material Inventory

Feature: 3  
Epic: 3.1  
Story: 3.1.1

Primary reference: `docs/architecture/security-critical-runtime-material-inventory.md`

## Goal

Provide a complete implementation-level inventory of security-critical runtime material used by the control plane and related hosts before fail-fast hardening changes.

## Inventory Coverage Summary

- Server-scoped material:
  - secret envelope master keys and encrypted payload directory
  - required system secret bootstrap controls and legacy migration inputs
  - internal CA bootstrap configuration, protected-secret-store keys, and managed TLS trust selectors
  - asset/content/image/generated-result token and encryption secrets
  - external adapter auth tokens (`AI_LOOM_COMFYUI_AUTH_TOKEN`, `PYTHON_RUNTIME_AUTH_TOKEN`)
- Workspace-scoped material:
  - workspace-bound token claims for asset/image/generated-result access
  - scope-derived encryption key references for workspace/storage-instance policy contexts
- User-scoped material:
  - opaque identity session bearer token issuance and hashed persistence
  - workspace invitation token issuance/hash storage
  - trusted-device pairing artifacts and trust marker handling

## Key Runtime Fallback Findings

- Non-durable generated fallback secrets exist in multiple host composition helpers:
  - `resolveAssetDownloadGrantSecret(...)`
  - `resolveAssetContentEncryptionKey(...)`
  - `resolveImageAssetStorageTokenSecret(...)`
  - `resolveImageAssetUploadSessionTokenSecret(...)`
  - `resolveGeneratedResultPreviewAccessTokenSecret(...)`
- Shared inherited fallback from `AI_LOOM_SECRET_MASTER_KEY` is reused by multiple unrelated token/encryption paths.
- Browser dev sync token still defaults to `"ai-loom-dev-sync"` when unset.

## Ambiguity and Duplication Callouts

1. Token/encryption secret fallback behavior is duplicated across storage/image/generated-result modules with partially different randomization patterns.
2. Identity-session signing secret bootstrap material is modeled, but active session tokens are opaque random bearer tokens instead of signed tokens.
3. Internal CA secret source can be either `env:<VAR>` or `secret-store:<id>` while protected-store key material itself is env-resolved.
4. Required system secret validation can be bypassed when `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` is unset/empty.

## Boundary Classification

- Host-resolved orchestration: selects required materials and startup failure policy.
- Infrastructure adapters: resolve env values, perform crypto, and persist/load protected material.
- Application use cases/services: enforce trust/authorization semantics for material consumption.

## Canonical Code Surfaces Used

- `src/hosts/server/composition/ServerSecretCompositionModule.ts`
- `src/hosts/server/composition/ServerCertificateCompositionModule.ts`
- `src/hosts/server/composition/ServerTlsMaterialCompositionModule.ts`
- `src/hosts/server/composition/ServerStorageAssetCompositionModule.ts`
- `src/hosts/server/composition/ServerImageMediaCompositionModule.ts`
- `src/hosts/server/composition/ServerGeneratedResultCompositionModule.ts`
- `src/infrastructure/security/secrets/*`
- `src/infrastructure/security/ca/*`
- `src/infrastructure/security/assets/EncryptedAssetDownloadGrantAdapter.ts`
- `src/infrastructure/media/generated-results/TokenizedGeneratedResultPreviewAccessPort.ts`
- `src/infrastructure/storage/image-assets/ManagedImageAssetStorageAdapter.ts`
- `src/infrastructure/config/AppRuntimeConfig.ts`
- `src/infrastructure/config/ComfyUiExecutionAdapterConfig.ts`
- `src/infrastructure/config/PythonRuntimeConfig.ts`
- `src/infrastructure/security/nodes/NodeBootstrapIdentityService.ts`
- `src/application/identity/services/TrustedDevicePairingService.ts`
- `src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase.ts`

## Story 3.1.3 Follow-On Enforcement

- Inventory findings now feed an explicit startup validation stage through:
  - `src/application/security/services/SecurityMaterialStartupValidationPipeline.ts`
  - `src/infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline.ts`
  - `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- Enforcement posture:
  - production-capable startup fails fast on missing/non-durable/disallowed required material.
  - development/test startup emits non-fatal structured diagnostics for policy-allowed optional material.

## Story 3.1.4 Runtime Fallback Hardening

- Removed random runtime fallback generation from:
  - `resolveAssetDownloadGrantSecret(...)`
  - `resolveAssetContentEncryptionKey(...)`
  - `resolveImageAssetStorageTokenSecret(...)`
  - `resolveImageAssetUploadSessionTokenSecret(...)`
  - `resolveGeneratedResultPreviewAccessTokenSecret(...)`
- Added centralized policy-aware material resolution:
  - `src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts`
- Runtime behavior now uses:
  - explicit provider-backed values in production-capable startup paths;
  - deterministic development/test fallback only when startup validation policy explicitly allows generated-ephemeral material, with diagnostic surfacing.
