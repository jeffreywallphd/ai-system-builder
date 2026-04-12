# Secret and Key Management Foundation

This note captures the Story 8.1.1 foundation for Feature 8 / Epic 8.1.

## Scope

Implemented in this slice:

- canonical secret domain contracts in `src/domain/security/SecretDomain.ts`
- scope ownership model for server, workspace, and user secrets
- domain invariants for secret naming, redaction-safe metadata, lifecycle states, and version lineage
- key-encryption context contracts aligned to secret ownership scope
- permission-checked and auditable secret access-decision contracts
- application security ports for secret persistence, encryption/decryption, access policy evaluation, and audit hooks
- application service contracts for create/read metadata/retrieve plaintext/rotate/disable/delete/list operations

Out of scope in this slice:

- storage adapters, SQL schema, or migration implementation
- KMS provider integrations and key lifecycle infrastructure
- UI handlers and transport adapters

## Canonical files

- `src/domain/security/SecretDomain.ts`
- `src/domain/security/tests/SecretDomain.test.ts`
- `src/application/security/ports/SecretServicePorts.ts`
- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/application/security/tests/SecretServiceContracts.test.ts`

## Domain contracts

`SecretDomain.ts` introduces first-class secret entities and policies:

- `SecretRecord`, `SecretReference`, and `SecretVersion`
- `SecretScope` (`server`, `workspace`, `user`) and `SecretScopeOwner`
- `SecretKind`
- `SecretProtectionPolicy`
- `KeyEncryptionContext`
- `SecretAccessDecision`

Key invariant posture:

- scope ownership combinations are explicit and validated:
  - server scope: no workspace/user owner identifiers
  - workspace scope: requires workspace id, no user id
  - user scope: requires user id, optional workspace id
- secret names are canonicalized and restricted to safe identifier patterns
- reference metadata is redaction-safe by contract (sensitive label keys and PEM-like values rejected)
- record lifecycle states are explicit (`active`, `disabled`, `archived`, `soft-deleted`)
- version lineage is explicit (`previousVersionId`, supersession semantics, single active version with `superseded` lineage)
- key-encryption context scope must match secret owner scope/identifiers

## Access decision contract

`evaluateSecretAccessDecision(...)` provides a reusable domain decision contract for permission and state checks:

- action permission check (`create`, `read-metadata`, `retrieve-plaintext`, `rotate`, `disable`, `delete`, `list`)
- scope ownership checks against actor context
- runtime plaintext retrieval denial checks for inactive records (`disabled`, `archived`, `soft-deleted`)
- policy-based runtime plaintext retrieval denial check
- deterministic decision/audit result (`allowed`, reason code, event type, actor, scope, timestamp)

This is the inner-layer seam for permission-checked and auditable secret retrieval behavior in later stories.

## Application contracts

`SecretServicePorts.ts` defines infrastructure-facing boundaries:

- `ISecretRecordPersistenceRepository`
- `ISecretEncryptionPort`
- `ISecretAccessPolicyPort`
- `ISecretAccessAuditPort`

`SecretManagementServiceContracts.ts` defines use-case/service-facing contracts:

- typed operation requests/results/errors
- `ISecretManagementService` with operations for:
  - create
  - read metadata
  - retrieve plaintext for authorized runtime use
  - rotate
  - disable
  - delete
  - list

These contracts establish stable extension points for persistence adapters, authorization integration, audit sinks, and UI/runtime integration work in subsequent stories.

## Boundary posture

- domain layer contains business semantics and invariants only
- application contracts depend on domain types and abstract ports only
- no storage, transport, UI, or host runtime behavior is introduced in domain contracts

## Story 3.1.2 Security Material Classification

- adds typed security material classification contracts in `src/application/security/contracts/SecurityMaterialClassificationContract.ts`
- models security material by:
  - category
  - scope (`server`/`workspace`/`user`/`storage-instance`)
  - durability (`durable` vs `ephemeral`)
  - startup requirement (`fail-fast-required` vs `optional`)
  - fallback policy
  - rotation posture
  - usage context
  - lifecycle-stage policy override (`production`/`development`/`test`)
- wires the classification contracts into a real startup path in `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts` so bootstrap diagnostics and startup validity are policy-derived instead of generic string handling
- distinguishes fail-fast required runtime material from optional development-ephemeral material:
  - provider credentials remain fail-fast required
  - identity-session signing material stays fail-fast in production and is optional/ephemeral in development policy

## Story 3.1.3 Startup Security Material Validation Pipeline

- adds reusable startup validation pipeline contracts in:
  - `src/application/security/services/SecurityMaterialStartupValidationPipeline.ts`
- adds authoritative-server security material catalog + host-profile lifecycle mapping in:
  - `src/infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline.ts`
- integrates validation into early authoritative security stage:
  - `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- startup behavior changes:
  - production-capable startup now fails fast when required durable material resolves from missing/non-durable/disallowed sources
  - development/test startup can continue with structured warning diagnostics for policy-allowed optional material
- stage output now exposes structured `startupSecurityMaterialValidation` diagnostics for testability and readiness telemetry integration

## Story 3.1.5 Centralized Security Material Resolution Interfaces

- adds centralized resolver ports in:
  - `src/application/security/ports/SecurityMaterialResolutionPorts.ts`
- separates read-only security material lookup from bootstrap mutation flow:
  - `SystemSecretBootstrapService` now uses an explicit runtime material resolver port for credential usability checks
  - bootstrap create/read responsibilities remain isolated behind bootstrap persistence helpers
- aligns host and transport startup composition to shared resolution interfaces:
  - `ServerPlatformSecretConsumers` now implements the runtime security material resolver port and supports server/workspace/user scope requests
  - managed TLS runtime trust material resolution is centralized in `ManagedServerTlsRuntimeMaterialResolver`
  - `ServerTlsMaterialCompositionModule` consumes typed `HostSecureTransportConfig.trustMaterial` fields plus the managed TLS resolver port, instead of ad hoc environment parsing
- reduces host-level secret/key lookup sprawl by enforcing one resolver seam for secret credentials and one resolver seam for managed TLS transport material

## Story 3.2.1 Secret provider ports and scope-aware resolution model

- adds provider-facing application ports in:
  - `src/application/security/ports/SecretProviderPorts.ts`
- introduces explicit provider material contracts for:
  - scope-aware selectors (`server`/`workspace`/`user`)
  - runtime read access context (`operationKey`, `serviceIdentity`, usage/justification, timestamp)
  - metadata/reference lookup versus raw value resolution
  - existence checks
  - bootstrap/write operations for missing provider material
- adds infrastructure resolution model implementation:
  - `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- migrates a real startup consumer:
  - `SystemSecretBootstrapService` now uses the provider resolution/bootstrap port for metadata lookup, existence checks, bootstrap creation, and runtime usability validation
- keeps caller isolation from storage details:
  - bootstrap and runtime consumers no longer compose secret metadata/create/runtime flows manually

## Story 3.2.2 Durable server secret store backend

- adds a dedicated durable backend for server-scoped provider/signing material:
  - `src/infrastructure/security/secrets/DurableServerSecretStoreBackend.ts`
- routes server-scope provider resolution operations through this backend while preserving workspace/user resolution behavior:
  - `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- adds controlled bootstrap initialization for server backend readiness checks before server-scope secret operations:
  - `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- backend responsibilities:
  - runtime secret-value resolution for server-scoped provider/signing material
  - metadata lookup and existence checks for server-scoped material
  - atomic bootstrap create with conflict-safe existing-record fallback
- persistence posture:
  - durable storage remains the composed secret service persistence stack (SQL secret records + encrypted payload storage), so server material survives host restarts
- scope boundaries:
  - belongs in server backend: authoritative control-plane provider credentials, server signing material, and other server-owned fail-fast runtime secrets
  - does not belong in server backend: workspace-shared credentials, user-personal credentials, or transient request/session-local values
- extension posture:
  - callers continue to depend on `ISecretProviderMaterialResolutionPort`
  - backend injection seam in `DefaultSecretProviderResolutionService` preserves compatibility with future external secret-store adapters

## Story 3.2.3 Optional local secure storage for user/device secrets

- adds an optional user-local secure store backend and keytar adapter seam:
  - `src/infrastructure/security/secrets/LocalUserSecureSecretStoreBackend.ts`
- updates provider-resolution routing to support optional user-local resolution without changing server/workspace authority:
  - `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- scope boundary posture:
  - server scope remains authoritative and always routes to `DurableServerSecretStoreBackend`
  - workspace scope remains managed through runtime secret consumption adapters
  - optional local secure storage is user scope only and rejects server/workspace selectors
- runtime/build posture:
  - `keytar` is loaded dynamically when available and is not required for core runtime/test execution
  - when `keytar` is unavailable, user-scope resolution falls back to managed secret-service adapters
  - this avoids forcing a brittle native dependency into environments that cannot support keytar packaging
- provider architecture posture:
  - callers continue to use `ISecretProviderMaterialResolutionPort`
  - local secure storage remains an infrastructure adapter detail, preserving caller isolation from storage implementation choices

## Story 3.2.4 Scoped secret retrieval use cases

- adds application-layer scoped provider retrieval and metadata/existence use-case flows in:
  - `src/application/security/use-cases/ScopedSecretProviderMaterialRetrievalUseCase.ts`
- scoped flows are explicit and permission-aware:
  - server-scoped retrieval/metadata/existence
  - workspace-scoped retrieval/metadata/existence
  - user-scoped retrieval/metadata/existence
- permission posture:
  - each scoped flow evaluates caller context against requested scope owner before provider-port access
  - retrieval requires `retrieve-plaintext` permission
  - metadata/existence requires `read-metadata` permission
  - out-of-scope requests are denied before storage/provider resolution is attempted
- runtime integration posture:
  - `SystemSecretBootstrapService` now validates required server-scoped material through the scoped retrieval use case for metadata existence checks and runtime usability checks
  - direct provider-port reads in bootstrap validation paths are reduced to preserve policy-aware retrieval boundaries
- minimal secret exposure posture:
  - metadata/existence flows remain available without plaintext retrieval permissions
  - plaintext is only resolved through explicit runtime-retrieval paths

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

## Tests

- `src/domain/security/tests/SecretDomain.test.ts` validates scope, naming, metadata safety, lifecycle, lineage, and access-decision invariants
- `src/application/security/tests/SecretServiceContracts.test.ts` validates contract-level operation semantics over in-memory adapters for all required operation categories
- `src/infrastructure/security/secrets/tests/LocalUserSecureSecretStoreBackend.test.ts` validates user-scope-only local secure store behavior and optional keytar availability handling
- `src/infrastructure/security/tests/DefaultSecretProviderResolutionService.test.ts` validates user-scope local-store routing preference with managed fallback and unchanged server/workspace routing boundaries
