# Secret Service Consumption Adapters

This note documents Story 8.2.5 (Feature 8 / Epic 8.2): add service-to-service secret consumption adapters so runtime consumers use formal secret retrieval flows instead of direct configuration or secret-store access.

## Canonical files

- `src/application/security/services/SecretRuntimeConsumptionAdapters.ts`
- `src/application/security/tests/SecretRuntimeConsumptionAdapters.test.ts`
- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`

## What was added

`SecretRuntimeConsumptionAdapters` introduces narrow helper methods for common runtime secret-consumption cases:

- `resolveWorkspaceProviderCredential(...)`
- `resolveUserPersonalApiKey(...)`
- `resolveServerSigningCredential(...)`

All methods call `retrieveSecretPlaintextForRuntime(...)` through `SecretRuntimeResolutionUseCaseContracts`, and do not perform any direct secret-store, database, or crypto operations.

## Runtime secret dependency pattern

Services that need credentials should depend on this pattern:

1. Accept a secret identifier and runtime governance context (`operationKey`, `serviceIdentity`, and optional explicit `justification`).
2. Select the appropriate adapter method based on ownership scope:
   - workspace provider credential -> workspace scope
   - user personal API key -> user scope
   - server signing credential -> server scope
3. Use returned `credential` (alias of runtime `plaintext`) for the immediate operation only.
4. Avoid persistent caching/logging of returned plaintext values.

## Policy and audit alignment

Adapters preserve policy-aware retrieval behavior by forwarding:

- runtime actor identity/type (`workspace-service` or `server-runtime`)
- scope owner details (`workspaceId`, `userIdentityId`, `scope`)
- operation governance fields (`operationKey`, `serviceIdentity`, `justification`, `occurredAt`)

This keeps authorization and audit behavior in the existing secret retrieval use case rather than duplicating controls in consumer services.

## Composition and host availability

`composeServerSecretService(...)` now publishes `runtimeSecretConsumptionAdapters` alongside existing secret use cases. Host-level and infrastructure services can adopt this seam incrementally without changing storage or crypto internals.

## Tests

Added/updated tests verify:

- adapters route each credential type through formal runtime retrieval with correct actor/scope context
- adapter error paths are passthrough from formal retrieval
- composed server host exposes adapters and can retrieve a server-scoped credential through the adapter surface
