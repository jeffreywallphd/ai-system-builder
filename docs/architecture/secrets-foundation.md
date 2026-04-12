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

## Tests

- `src/domain/security/tests/SecretDomain.test.ts` validates scope, naming, metadata safety, lifecycle, lineage, and access-decision invariants
- `src/application/security/tests/SecretServiceContracts.test.ts` validates contract-level operation semantics over in-memory adapters for all required operation categories
