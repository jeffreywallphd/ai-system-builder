# AI Companion: Secret Service Consumption Adapters

## Purpose

Story 8.2.5 baseline for Feature 8 / Epic 8.2: provide reusable service-to-service adapters so runtime modules consume secrets through formal secret retrieval use cases instead of ad hoc config or direct secret-store access.

## Canonical files

- `src/application/security/services/SecretRuntimeConsumptionAdapters.ts`
- `src/application/security/tests/SecretRuntimeConsumptionAdapters.test.ts`
- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`
- `docs/architecture/secrets-service-consumption-adapters.md`

## Adapter contract summary

`SecretRuntimeConsumptionAdapters` is an application-facing helper around `SecretRuntimeResolutionUseCaseContracts` (`retrieveSecretPlaintextForRuntime`):

- `resolveWorkspaceProviderCredential(...)`
- `resolveUserPersonalApiKey(...)`
- `resolveServerSigningCredential(...)`

Each adapter method:

- constructs runtime actor context (`server-runtime` or `workspace-service`)
- constrains scope owner context (`server`, `workspace`, or `user`)
- forwards governance fields (`operationKey`, `serviceIdentity`, `justification`, `occurredAt`)
- calls the formal runtime retrieval use case
- returns the retrieval payload plus `credential` alias for consuming services

## Governance and boundary posture

- Adapters do not perform crypto, persistence, or secret-store reads directly.
- Adapters do not bypass policy evaluation or runtime-retrieval validation.
- Runtime retrieval remains the only path to plaintext through this service boundary.
- Callers are expected to provide operation-specific `operationKey` values to keep audit lineage stable and queryable.

## Composition posture

- `composeServerSecretService(...)` now exposes `runtimeSecretConsumptionAdapters` so host-level or infrastructure services can depend on a stable secret-consumption seam.
- Existing use-case exposures remain unchanged; adapters are additive and narrow.

## Test posture

Coverage verifies:

- workspace provider credential requests route through formal runtime retrieval with workspace-service actor/scope context
- user personal API key requests route through formal runtime retrieval with user scope-owner context
- server signing credential requests route through formal runtime retrieval with server-runtime actor/scope context
- adapter errors are passthrough from formal retrieval (no hidden fallback paths)
- host composition exposes and successfully executes adapter-based runtime retrieval
