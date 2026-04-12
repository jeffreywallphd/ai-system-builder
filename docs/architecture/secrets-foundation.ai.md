# AI Companion: Secret and Key Management Foundation

## What this slice does

- Adds canonical secret domain contracts in `src/domain/security/SecretDomain.ts`.
- Establishes server/workspace/user ownership scope rules.
- Defines secret invariants for naming, metadata redaction safety, lifecycle state, and version lineage.
- Defines key-encryption-context contracts aligned with scope ownership.
- Adds access decision contracts for permission-checked and auditable secret retrieval flows.
- Adds application security ports and service contracts for create/read/retrieve/rotate/disable/delete/list operations.

## Main files

- `src/domain/security/SecretDomain.ts`
- `src/domain/security/tests/SecretDomain.test.ts`
- `src/application/security/ports/SecretServicePorts.ts`
- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/application/security/tests/SecretServiceContracts.test.ts`
- `docs/architecture/secrets-foundation.md`

## Important invariants

- Scope combinations:
  - `server`: no workspace/user identifiers.
  - `workspace`: requires workspace id and no user id.
  - `user`: requires user id (workspace id optional).
- Secret names are normalized/lowercase and pattern-validated.
- Metadata labels are redaction-safe by contract (sensitive key names and PEM-like values rejected).
- Secret record state is explicit (`active`, `disabled`, `archived`, `soft-deleted`).
- Secret version lineage is explicit and validated (`previousVersionId`, supersession, single active version).
- Key-encryption context scope and owner identifiers must match the secret owner scope.

## Application boundaries

Ports:

- `ISecretRecordPersistenceRepository`
- `ISecretEncryptionPort`
- `ISecretAccessPolicyPort`
- `ISecretAccessAuditPort`

Service contract:

- `ISecretManagementService` for create/read metadata/retrieve plaintext/rotate/disable/delete/list.

The slice is contracts-only and keeps src/infrastructure/UI concerns out of src/domain/application boundaries.

## Story 3.1.2 Security Material Classification

- Adds typed security material classification contracts in `src/application/security/contracts/SecurityMaterialClassificationContract.ts`.
- Models security material by:
  - category
  - scope (`server`/`workspace`/`user`/`storage-instance`)
  - durability (`durable` vs `ephemeral`)
  - startup requirement (`fail-fast-required` vs `optional`)
  - fallback policy
  - rotation posture
  - usage context
  - lifecycle-stage policy override (`production`/`development`/`test`)
- Wires the classification contracts into a real startup path in `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts` so bootstrap diagnostics and startup validity are policy-derived instead of generic string handling.
- Distinguishes fail-fast required runtime material from optional development-ephemeral material:
  - provider credentials remain fail-fast required.
  - identity-session signing material stays fail-fast in production and is optional/ephemeral in development policy.

## Story 3.1.3 Startup Security Material Validation Pipeline

- Adds reusable startup validation pipeline contracts in:
  - `src/application/security/services/SecurityMaterialStartupValidationPipeline.ts`
- Adds authoritative-server security material catalog + host-profile lifecycle mapping in:
  - `src/infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline.ts`
- Integrates validation into early authoritative security stage:
  - `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- Startup behavior changes:
  - production-capable startup now fails fast when required durable material resolves from missing/non-durable/disallowed sources.
  - development/test startup can continue with structured warning diagnostics for policy-allowed optional material.
- Stage output now exposes structured `startupSecurityMaterialValidation` diagnostics for testability and readiness telemetry integration.

## Story 3.1.5 Centralized Security Material Resolution Interfaces

- Adds centralized resolver ports in:
  - `src/application/security/ports/SecurityMaterialResolutionPorts.ts`
- Separates read-only lookup from bootstrap mutation responsibilities:
  - `SystemSecretBootstrapService` now depends on a runtime security material resolver port for runtime usability checks.
  - bootstrap create/read behavior stays isolated in dedicated bootstrap persistence helpers.
- Refactors host and transport consumers to typed resolver seams:
  - `ServerPlatformSecretConsumers` now implements the runtime security material resolver port and supports server/workspace/user scope requests.
  - managed TLS runtime trust material resolution is centralized in `ManagedServerTlsRuntimeMaterialResolver`.
  - `ServerTlsMaterialCompositionModule` resolves managed TLS material from `HostSecureTransportConfig.trustMaterial` + resolver port, not ad hoc environment reads.
- Result: reduced host-level secret/key handling sprawl and consistent resolution behavior across secret consumers and transport startup.

## Story 3.2.1 Secret provider ports and scope-aware resolution model

- Adds provider-facing application ports in:
  - `src/application/security/ports/SecretProviderPorts.ts`
- Contracts now distinguish:
  - scope-aware selection (`server`/`workspace`/`user`)
  - metadata/reference lookup vs raw secret-value resolution
  - existence checks
  - bootstrap/write operations for missing provider material
- Adds infrastructure resolution model implementation in:
  - `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- Migrates `SystemSecretBootstrapService` to consume the provider resolution/bootstrap port for metadata lookup, existence checks, bootstrap creation, and runtime validation.

## Story 3.2.2 Durable server secret store backend

- Adds a dedicated durable backend for server-scoped provider/signing material:
  - `src/infrastructure/security/secrets/DurableServerSecretStoreBackend.ts`
- Routes server-scope provider resolution operations through this backend while preserving workspace/user resolution behavior:
  - `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- Adds controlled bootstrap initialization for server backend readiness checks before server-scope secret operations:
  - `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- Backend responsibilities:
  - runtime secret-value resolution for server-scoped provider/signing material
  - metadata lookup and existence checks for server-scoped material
  - atomic bootstrap create with conflict-safe existing-record fallback
- Persistence posture:
  - durable storage remains the composed secret service persistence stack (SQL secret records + encrypted payload storage), so server material survives host restarts.
- Scope boundaries:
  - belongs in server backend: authoritative control-plane provider credentials, server signing material, and other server-owned fail-fast runtime secrets
  - does not belong in server backend: workspace-shared credentials, user-personal credentials, or transient request/session-local values
- Extension posture:
  - callers continue to depend on `ISecretProviderMaterialResolutionPort`
  - backend injection seam in `DefaultSecretProviderResolutionService` preserves compatibility with future external secret-store adapters.

## Story 3.2.3 Optional local secure storage for user/device secrets

- Adds optional local user secure-store backend and keytar adapter seam in:
  - `src/infrastructure/security/secrets/LocalUserSecureSecretStoreBackend.ts`
- Extends provider-resolution routing while preserving existing authority boundaries:
  - `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- Scope boundaries are explicit:
  - server scope remains authoritative via `DurableServerSecretStoreBackend`
  - workspace scope remains resolved through managed runtime secret adapters
  - optional local secure storage is user scope only and rejects server/workspace selectors
- Build/runtime posture:
  - `keytar` is dynamically loaded only when available
  - keytar is not required for baseline runtime and test execution
  - when keytar is unavailable, user-scope resolution falls back to managed secret-service adapters
- Architectural effect:
  - callers stay on `ISecretProviderMaterialResolutionPort`
  - local secure storage remains an adapter concern rather than a caller-level branching concern

## Story 3.2.4 Scoped secret retrieval use cases

- Adds scoped provider retrieval use-case flows in:
  - `src/application/security/use-cases/ScopedSecretProviderMaterialRetrievalUseCase.ts`
- Scope-explicit reads are now available for:
  - server scope
  - workspace scope
  - user scope
- Permission/context posture:
  - each flow checks caller context against requested scope before provider-port access
  - plaintext retrieval requires `retrieve-plaintext`
  - metadata/existence checks require `read-metadata`
  - out-of-scope access is denied before storage/provider resolution runs
- Runtime integration update:
  - `SystemSecretBootstrapService` now uses the scoped retrieval use case for metadata existence and runtime validation checks
  - this reduces direct provider-port read bypasses in bootstrap validation paths
- Secret exposure minimization:
  - metadata/existence remain available without plaintext retrieval permissions
  - plaintext resolution remains isolated to explicit runtime retrieval flows

## Story 3.2.5 Secret metadata and reference modeling

- adds explicit provider-material metadata modeling in:
  - `src/application/security/ports/SecretProviderPorts.ts`
- metadata/reference flows now return `SecretProviderMaterialMetadata` (never raw values) with:
  - secret identity (`providerId`, `secretId`, `materialKind`)
  - explicit scope ownership (`server`/`workspace`/`user`)
  - backend identity (`durable-server-secret-store`, `managed-secret-service`, `local-user-secure-secret-store`)
  - lifecycle timestamps (`updatedAt`, optional `createdAt`)
  - rotation posture (`status`, `currentVersionId`)
  - policy flags (`metadataSafeForDiagnostics`, `plaintextAccessRequiresDedicatedRetrievalFlow`, optional fail-fast flag)
- provider implementations now emit metadata through this model:
  - `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
  - `src/infrastructure/security/secrets/DurableServerSecretStoreBackend.ts`
  - `src/infrastructure/security/secrets/LocalUserSecureSecretStoreBackend.ts`
- diagnostics/admin readiness:
  - system bootstrap result now includes metadata-only `materialMetadata` for resolvable required secrets
  - secret diagnostics payload includes `bootstrap.materialMetadata` for governance and audit tooling without exposing plaintext

## Story 3.2.6 Refactor existing secret consumers onto provider flows

- migrates primary runtime secret consumers from scattered env/fallback reads onto provider-first retrieval flow in:
  - `src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts`
- provider-first posture for server runtime material:
  - resolve server-scoped provider material through `ScopedSecretProviderMaterialRetrievalUseCase`
  - route retrieval/bootstrap through `DefaultSecretProviderResolutionService` and durable server backend seams
  - keep governed deterministic development fallback centralized behind startup validation policy checks
- host composition updates:
  - `ServerStorageAssetCompositionModule`, `ServerImageMediaCompositionModule`, and `ServerGeneratedResultCompositionModule` now resolve security-critical token/encryption material through the provider resolver path
  - these composition modules now receive `secretService` explicitly to keep runtime secret access governed and auditable
- CA/signing material access updates:
  - `EnvironmentCertificateAuthoritySecretService` now supports provider-backed `secret:<id>` metadata references through scoped server provider retrieval flow
  - `ServerCertificateCompositionModule` composes scoped provider retrieval for CA bootstrap secret metadata checks
- migration compatibility:
  - when provider material is absent, legacy configured values can be used as migration input and bootstrap attempts are executed through provider bootstrap flow rather than direct consumer-level parsing
- duplication reduction:
  - secret resolution/parsing behavior is centralized in one composition resolver surface, reducing repeated env/inherited fallback logic across asset/image/generated-result consumers
