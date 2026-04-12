# Secret Service Consumption Adapters

This note documents Story 8.2.5 (Feature 8 / Epic 8.2) and Story 8.3.4 (Feature 8 / Epic 8.3): service-to-service secret consumption adapters and first platform configuration consumer integration so runtime modules use formal secret retrieval flows instead of direct configuration or secret-store access.

## Canonical files

- `src/application/security/services/SecretRuntimeConsumptionAdapters.ts`
- `src/application/security/ports/SecretProviderPorts.ts`
- `src/infrastructure/security/secrets/ServerPlatformSecretConsumers.ts`
- `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/infrastructure/security/secrets/tests/ServerPlatformSecretConsumers.test.ts`
- `src/infrastructure/security/tests/DefaultSecretProviderResolutionService.test.ts`
- `src/application/security/tests/SecretRuntimeConsumptionAdapters.test.ts`
- `src/application/security/tests/SecretProviderPorts.test.ts`
- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `src/hosts/server/tests/IdentityServerHost.test.ts`

## What was added

`SecretRuntimeConsumptionAdapters` introduces narrow helper methods for common runtime secret-consumption cases:

- `resolveWorkspaceProviderCredential(...)`
- `resolveUserPersonalApiKey(...)`
- `resolveServerSigningCredential(...)`

All methods call `retrieveSecretPlaintextForRuntime(...)` through `SecretRuntimeResolutionUseCaseContracts`, and do not perform any direct secret-store, database, or crypto operations.

`ServerPlatformSecretConsumers` now provides the first concrete platform-facing consumer surface:

- `resolveServerProviderCredential(...)`
- `resolveIdentitySessionSigningMaterial(...)`

This service depends only on `runtimeSecretConsumptionAdapters`, giving host/runtime modules a formal seam for protected provider credentials and server signing material.

Story 3.2.1 adds a provider-resolution seam for broader provider workflows:

- `src/application/security/ports/SecretProviderPorts.ts`
- `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`

## Runtime secret dependency pattern

Services that need credentials should depend on this pattern:

1. Accept a secret identifier and runtime governance context (`operationKey`, `serviceIdentity`, and optional explicit `justification`).
2. Select the appropriate adapter method based on ownership scope:
   - workspace provider credential -> workspace scope
   - user personal API key -> user scope
   - server signing credential -> server scope
3. Use returned `credential` (alias of runtime `plaintext`) for the immediate operation only.
4. Avoid persistent caching/logging of returned plaintext values.

For server platform configuration consumers, use the same pattern through `ServerPlatformSecretConsumers`:

1. identify a formal secret id for the platform dependency (for example `secret:server:provider:openai` or `secret:server:signing:identity-session`)
2. call `resolveServerProviderCredential(...)` or `resolveIdentitySessionSigningMaterial(...)`
3. use returned `credential` only for the immediate operation
4. do not fall back to plaintext legacy environment configuration for runtime consumption

## Policy and audit alignment

Adapters preserve policy-aware retrieval behavior by forwarding:

- runtime actor identity/type (`workspace-service` or `server-runtime`)
- scope owner details (`workspaceId`, `userIdentityId`, `scope`)
- operation governance fields (`operationKey`, `serviceIdentity`, `justification`, `occurredAt`)

This keeps authorization and audit behavior in the existing secret retrieval use case rather than duplicating controls in consumer services.

## Composition and host availability

`composeServerSecretService(...)` now publishes `runtimeSecretConsumptionAdapters` alongside existing secret use cases. Host-level and infrastructure services can adopt this seam incrementally without changing storage or crypto internals.

Story 8.3.4 and Story 3.2.1 integration adopt this seam in `SystemSecretBootstrapService`:

- metadata lookup and existence checks use `ISecretProviderMaterialResolutionPort`
- bootstrap create/write of missing provider material uses `bootstrapSecretProviderMaterial(...)`
- runtime credential/signing validation uses `resolveSecretProviderMaterial(...)`
- startup bootstrap no longer manually composes metadata/create/runtime flows in service-local helpers

## Tests

Added/updated tests verify:

- adapters route each credential type through formal runtime retrieval with correct actor/scope context
- adapter error paths are passthrough from formal retrieval
- composed server host exposes adapters and can retrieve a server-scoped credential through the adapter surface
- platform consumer methods route through runtime adapter semantics and preserve error passthrough behavior
- host startup bootstrap migration can immediately resolve migrated provider credentials through `platformSecretConsumers`
- provider resolution service validates scope-aware server/workspace/user reads plus metadata/existence/bootstrap operations
