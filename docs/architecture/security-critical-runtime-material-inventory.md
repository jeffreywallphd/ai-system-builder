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
  - src/infrastructure/config
  - src/application/security
  - src/application/identity
  - src/application/workspaces
---

# Security-Critical Runtime Material Inventory

Feature: 3  
Epic: 3.1  
Story: 3.1.1

## Purpose

Provide an implementation-level inventory of security-critical material resolved by the authoritative control plane and related runtime hosts before fail-fast hardening work changes behavior.

## Scope and Method

- Scope: current `dev` branch behavior in server host composition plus related runtime hosts/adapters.
- Sources: implementation paths under `src/hosts`, `src/infrastructure/security`, `src/infrastructure/config`, and security-sensitive application services.
- Inclusion rule: secrets, signing/encryption keys, token seeds, certificate/trust artifacts, and trust-bound credential inputs that can impact runtime security posture.

## Inventory

| Material | Scope | Resolution Source | Current Fallback / Implicit Behavior | Persistence and Durability Expectation | Consuming Subsystem | Resolution Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| Secret envelope master key (`AI_LOOM_SECRET_MASTER_KEY_ID`, `AI_LOOM_SECRET_MASTER_KEY`, optional version/reference) | server | Environment in [SecretServiceComposition.ts](../../src/infrastructure/security/secrets/SecretServiceComposition.ts) | If both ID and key are absent, secret encryption is marked unconfigured and plaintext operations fail at use time. If only one is set, startup throws configuration error. | Must be durable and explicitly provisioned for production secret lifecycle continuity. | Secret CRUD/retrieval/envelope encryption ports. | Infrastructure adapter (composed by server host module). |
| Secret encrypted payload directory (`AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY`) | server | Environment in [SecretServiceComposition.ts](../../src/infrastructure/security/secrets/SecretServiceComposition.ts) | Defaults to sibling `secret-envelopes` directory near authoritative database path. | Durable filesystem path expected for encrypted payload continuity across restarts. | Secret encrypted payload store. | Infrastructure adapter. |
| Required system secret IDs (`AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`) and migration gate (`AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV`) | server | Environment in [SystemSecretBootstrapService.ts](../../src/infrastructure/security/secrets/SystemSecretBootstrapService.ts) | Empty required list means bootstrap passes without validation. Migration gate defaults to enabled when unset. | Required list should be explicit in production to avoid silent under-validation of critical secrets. | Server startup secret bootstrap safety check. | Host composition invoking infrastructure secret bootstrap. |
| Legacy provider/signing secret inputs (`OPENAI_API_KEY`, `HUGGINGFACE_API_TOKEN`, `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY`) | server | Environment in [SystemSecretBootstrapService.ts](../../src/infrastructure/security/secrets/SystemSecretBootstrapService.ts) | Used only for bootstrap migration into secret service when required secret IDs are configured and secret is missing. | Should be transitional; durable source should be secret service records rather than long-term env fallback. | Provider credential and signing-material bootstrap checks. | Infrastructure bootstrap adapter. |
| Internal protected secret store directory/key(s) (`AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY`, `AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEY`, `AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEYS_BY_SCOPE`) | server | Environment in [FileSystemProtectedSecretStore.ts](../../src/infrastructure/security/secrets/FileSystemProtectedSecretStore.ts) | If no protected-store settings are present, store is disabled (`undefined`). Partial config throws fail-fast errors. | Must be durable for CA/trust material decryption and managed TLS startup continuity. | Protected secret store and CA material storage adapters. | Infrastructure adapter composed by server secret module. |
| Internal CA bootstrap identifiers and root refs (`AI_LOOM_INTERNAL_CA_ID`, root material refs, root secret refs) | server | Environment in [InternalCertificateAuthorityBootstrapEnvironmentAdapter.ts](../../src/infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter.ts) and startup use case | Missing all config produces `uninitialized` state; partial config marks invalid; persisted/config mismatch requires migration. Secret refs support `env:<VAR>` or `secret-store:<id>`. | Must align with persisted CA metadata and trust-material records for safe startup. | CA startup validation and certificate operations composition. | Host invokes application use case through infrastructure providers. |
| Managed server TLS enablement and selection (`AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED`, reference/material selectors) | server | Environment in [ServerTlsMaterialCompositionModule.ts](../../src/hosts/server/composition/ServerTlsMaterialCompositionModule.ts) and [HostSecureTransportConfig.ts](../../src/infrastructure/config/HostSecureTransportConfig.ts) | When managed TLS is required and trust material cannot be resolved, startup fails. When disabled, HTTP/WS may remain loopback-allowed depending on transport policy flags. | Production should enforce explicit TLS material and fail-fast on absence. | Identity HTTP server TLS factory and transport trust validators. | Host module delegates trust material retrieval to infrastructure + application ports. |
| Asset download grant secret (`AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET`) | workspace (token claims include workspace/user/asset) | Environment in [ServerStorageAssetCompositionModule.ts](../../src/hosts/server/composition/ServerStorageAssetCompositionModule.ts) via [ResolveCriticalServerSecurityMaterial.ts](../../src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts) | No random runtime fallback. Resolution is explicit env-only in production-capable startup. Development/test can use deterministic, policy-governed fallback only when allowed by startup security-material validation. | Durable explicit provider-backed value required for production continuity across restarts. | Encrypted asset download grant adapter. | Host composition helper feeding infrastructure adapter. |
| Asset content encryption key (`AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY`) and key prefix (`AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY_PREFIX`) | workspace/storage-instance effective scope (single underlying key bytes) | Environment in [ServerStorageAssetCompositionModule.ts](../../src/hosts/server/composition/ServerStorageAssetCompositionModule.ts) via deterministic key port and [ResolveCriticalServerSecurityMaterial.ts](../../src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts) | Resolution order: explicit key -> inherited `AI_LOOM_SECRET_MASTER_KEY` -> deterministic development/test fallback only when startup policy permits generated ephemeral material. Prefix defaults to `kek:asset-content`. | Durable explicit provider-backed key material required for production continuity. | Asset encryption key resolution and AES-GCM content cipher. | Host composition helper + infrastructure crypto adapter. |
| Image asset storage access token secret (`AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET`) | workspace/user-bound token claims | Environment in [ServerImageMediaCompositionModule.ts](../../src/hosts/server/composition/ServerImageMediaCompositionModule.ts) via [ResolveCriticalServerSecurityMaterial.ts](../../src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts) | Resolution order: explicit secret -> inherited `AI_LOOM_SECRET_MASTER_KEY` -> deterministic development/test fallback only when startup policy permits generated ephemeral material. | Durable explicit provider-backed value required for production continuity and predictable verification semantics. | Managed image asset storage adapter access tokens. | Host composition helper feeding infrastructure storage adapter. |
| Image asset upload session token secret (`AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET`) | workspace/user-bound upload sessions | Environment in [ServerImageMediaCompositionModule.ts](../../src/hosts/server/composition/ServerImageMediaCompositionModule.ts) via [ResolveCriticalServerSecurityMaterial.ts](../../src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts) | Resolution order mirrors storage token secret. No random per-process startup generation remains. | Durable explicit provider-backed value required for production upload-session integrity. | Image asset management backend API upload-session signing. | Host composition helper. |
| Generated-result preview access token secret (`AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET`) | workspace-scoped preview access handles | Environment in [ServerGeneratedResultCompositionModule.ts](../../src/hosts/server/composition/ServerGeneratedResultCompositionModule.ts) via [ResolveCriticalServerSecurityMaterial.ts](../../src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts) | Resolution order: explicit secret -> inherited `AI_LOOM_SECRET_MASTER_KEY` -> deterministic development/test fallback only when startup policy permits generated ephemeral material. | Durable explicit provider-backed value required for production continuity of preview-handle verification semantics. | Generated-result preview access port. | Host composition helper feeding infrastructure media adapter. |
| ComfyUI auth token (`AI_LOOM_COMFYUI_AUTH_TOKEN`) | server/runtime integration | Environment in [ComfyUiExecutionAdapterConfig.ts](../../src/infrastructure/config/ComfyUiExecutionAdapterConfig.ts) | Optional; adapter can run without token when upstream permits anonymous access. | If remote execution adapter requires auth, token should be explicit and governed as secret material. | ComfyUI execution adapter HTTP integration. | Infrastructure config resolved by host startup composition. |
| Python runtime auth token (`PYTHON_RUNTIME_AUTH_TOKEN`) | server/desktop runtime bridge | Environment in [PythonRuntimeConfig.ts](../../src/infrastructure/config/PythonRuntimeConfig.ts) | Optional; runtime config can operate without it depending on runtime mode/external service policy. | When runtime endpoint is protected, token should be durable and explicitly governed. | Python runtime client/supervisor integration. | Infrastructure runtime config. |
| Dev sync token (`VITE_DEV_SYNC_TOKEN`) | user/browser-development session scope | Environment/bootstrap window value in [AppRuntimeConfig.ts](../../src/infrastructure/config/AppRuntimeConfig.ts) | Defaults to constant `"ai-loom-dev-sync"` when unset. | Intended for development; not suitable as durable or secure production secret. | Browser development sync client configuration. | Infrastructure runtime config (renderer-side). |
| Identity session opaque bearer token material | user | Runtime generation in [OpaqueIdentitySessionTokenService.ts](../../src/infrastructure/security/identity/OpaqueIdentitySessionTokenService.ts) | Always generated using `randomBytes(32)` and stored/compared by SHA-256 hash; no configurable signing key currently used. | Session token hash persistence is durable; plaintext token is ephemeral by design. | Authenticated session lifecycle and identity auth APIs. | Infrastructure identity token service inside host composition module. |
| Workspace invitation tokens | user/workspace | Runtime generation in [IssueWorkspaceInvitationUseCase.ts](../../src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase.ts) | Random token generated in-memory; only SHA-256 hash + hint are persisted. | Durable hash persistence required; plaintext token intentionally non-durable. | Workspace invitation issuance and lifecycle flows. | Application use case (host-composed). |
| Trusted-device pairing artifacts and trust marker inputs | user/workspace | Runtime generation and hashing in [TrustedDevicePairingService.ts](../../src/application/identity/services/TrustedDevicePairingService.ts) | Pairing artifact values generated via `randomBytes`; token hashes persisted; default trust material ref may be synthesized when completion does not supply one. | Pairing token hashes and trusted-device records are durable; artifact plaintext is ephemeral. | Trusted-device pairing and session trust bootstrap. | Application identity service (host-composed). |
| Node bootstrap identity keypair + fingerprint (`node-bootstrap-private-key.pem`, `node-bootstrap-public-key.pem`) | server-related host (execution node) | Local file bootstrap in [NodeBootstrapIdentityService.ts](../../src/infrastructure/security/nodes/NodeBootstrapIdentityService.ts) | If bootstrap files are partially present, service fails and requires repair. If absent, keypair is generated (ed25519) and persisted. | Must be durable for stable node identity and enrollment trust continuity. | Node enrollment submission and transport identity evidence. | Infrastructure node-host adapter (related host path). |

## Host vs Infrastructure Resolution Boundaries

- Host composition roots choose which security material categories are required at startup and whether failures are fatal.
  - [ServerSecretCompositionModule.ts](../../src/hosts/server/composition/ServerSecretCompositionModule.ts)
  - [ServerCertificateCompositionModule.ts](../../src/hosts/server/composition/ServerCertificateCompositionModule.ts)
  - [ServerTlsMaterialCompositionModule.ts](../../src/hosts/server/composition/ServerTlsMaterialCompositionModule.ts)
  - [ServerStorageAssetCompositionModule.ts](../../src/hosts/server/composition/ServerStorageAssetCompositionModule.ts)
  - [ServerImageMediaCompositionModule.ts](../../src/hosts/server/composition/ServerImageMediaCompositionModule.ts)
  - [ServerGeneratedResultCompositionModule.ts](../../src/hosts/server/composition/ServerGeneratedResultCompositionModule.ts)
- Infrastructure adapters resolve concrete environment values, perform crypto operations, and persist/load material.
  - `src/infrastructure/security/*`
  - `src/infrastructure/config/*`
  - `src/infrastructure/storage/*`
  - `src/infrastructure/media/*`
- Application services consume material through ports and enforce trust/authorization semantics.
  - `src/application/security/*`
  - `src/application/identity/*`
  - `src/application/workspaces/*`
  - `src/application/nodes/*`

## Ambiguous and Duplicated Resolution Paths (Documented, Not Normalized)

1. Multiple independent token-secret resolvers reuse the same fallback chain (`explicit -> AI_LOOM_SECRET_MASTER_KEY -> random generated hash`) in:
   - asset content encryption key
   - image storage access token secret
   - image upload session token secret
   - generated-result preview access token secret
2. Asset download grant secret has a separate fallback (`asset-download-grant:${randomUUID()}`) instead of sharing the above chain, creating different restart semantics across tokenized subsystems.
3. `secret:server:signing:identity-session` is modeled as required bootstrap material, but active identity sessions currently use opaque random bearer tokens (`OpaqueIdentitySessionTokenService`) rather than explicit signing-key cryptography.
4. Internal CA secret references support both `env:<VARIABLE>` and `secret-store:<id>`, while protected secret-store encryption keys are also delivered via environment values, producing layered and partially duplicated secret-source paths.
5. Browser development sync token uses a hardcoded default (`"ai-loom-dev-sync"`) when unset, which is security-sensitive but outside durable secret-governed server paths.

## Fail-Fast vs Degraded Startup Notes (Current Behavior)

- Explicit fail-fast:
  - Incomplete secret master key config throws during secret-service composition.
  - Managed TLS required but unavailable trust material throws and blocks startup.
  - CA startup state `invalid`, `revoked`, or `migration-required` throws.
  - Partially present node bootstrap material throws and blocks node bootstrap.
- Degraded/implicit:
  - Missing optional token/key secrets can silently generate non-durable per-process material in several composition modules.
  - Empty required-system-secret list bypasses bootstrap secret validation.

## Story 3.1.3 Follow-On Enforcement

- Inventory findings now feed an explicit startup validation stage through:
  - `src/application/security/services/SecurityMaterialStartupValidationPipeline.ts`
  - `src/infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline.ts`
  - `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- Enforcement posture:
  - production-capable startup fails fast on missing/non-durable/disallowed required material
  - development/test startup emits non-fatal structured diagnostics for policy-allowed optional material

## Story 3.1.4 Runtime Fallback Hardening

- Removed adapter-local random runtime fallback generation for:
  - asset download grant secret
  - asset content encryption key
  - image asset storage token secret
  - image asset upload session token secret
  - generated-result preview access token secret
- Added centralized critical material resolution in `src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts`.
- Runtime resolution is now policy-aware:
  - production-capable startup requires provider-backed configured material (explicit env or allowed inherited env where documented);
  - development/test fallback is only available when startup security-material validation classifies the material as policy-allowed generated-ephemeral and emits diagnostics.

## Related ADRs

- [ADR-001 Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.md)
- [ADR-005 Trust, Identity, and Security Boundary Enforcement](../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)
