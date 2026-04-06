# Secret-Backed Feature Extension Guidance

This note documents Story 8.3.7 (Feature 8 / Epic 8.3): contributor guidance for extending AI Loom with secret-backed behavior using the formal secret service architecture.

## Canonical implementation seams

- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/application/security/services/SecretRuntimeConsumptionAdapters.ts`
- `src/application/security/use-cases/RetrieveSecretPlaintextForRuntimeUseCase.ts`
- `src/application/security/use-cases/RotateSecretUseCase.ts`
- `src/application/security/use-cases/SecretScopeResolver.ts`
- `src/application/security/use-cases/SecretAuthorizationPolicyEvaluator.ts`
- `src/shared/security/SecretRedaction.ts`
- `src/shared/dto/security/SecretTransportDtos.ts`
- `src/infrastructure/security/secrets/ServerPlatformSecretConsumers.ts`
- `src/infrastructure/security/secrets/SecretServiceComposition.ts`

## Extension objective

When adding a feature that needs credentials, signing material, or API tokens, treat secret access as an application boundary dependency. New modules must consume secrets through formal use cases/adapters and never through plaintext environment/config reads in runtime code paths.

## Scope selection and ownership rules

Select scope based on ownership of the secret, not the caller that consumes it.

- `server` scope: host-wide credentials/signing material shared across workspaces/users.
- `workspace` scope: shared integration credentials owned by one workspace.
- `user` scope: personal user keys or tokens, optionally workspace-associated.

Rules that must stay true:

- Do not encode scope inference in UI or host modules; use `SecretScopeResolver` and domain scope-owner invariants.
- Secret IDs and names should remain deterministic and scope-aware (`secret:server:*`, `secret:workspace:*`, `secret:user:*`).
- Never reuse a `user` secret as a de facto `workspace` secret to "simplify" setup.

## DTO safety and response posture

Secret transport boundaries are command/query separated by design.

- Mutations accept plaintext only in command DTOs (create/rotate/re-encryption commands).
- Query/list/detail DTOs are metadata-only and must not add plaintext/ciphertext fields.
- Feature-specific API surfaces should map secret errors to stable non-leaky error contracts; do not pass through raw underlying exceptions.

Contributor rule: if a new API route returns secret metadata, verify its DTO shape against `src/shared/dto/security/SecretTransportDtos.ts` patterns and keep plaintext absent.

## Redaction and logging requirements

All secret-related diagnostics and logs must pass through redaction helpers.

- Use `redactSecretMaterial(...)` and `sanitizeSecretOperationalEvent(...)` for structured logs.
- Log identifiers and operational outcomes only (`secretId`, scope, result code, actor/service identity).
- Do not log request bodies that may contain plaintext, token values, private keys, or decrypted payloads.
- Keep audit details metadata-only; plaintext in audit events is always forbidden.

## Retrieval patterns for runtime services

Runtime consumers should depend on adapters rather than on repositories/crypto ports.

Preferred pattern:

1. Depend on `ISecretRuntimeConsumptionAdapters` (or `ServerPlatformSecretConsumers` for server-host integrations).
2. Provide `operationKey`, `serviceIdentity`, and scope-specific IDs.
3. Call only the narrow resolver that matches ownership scope.
4. Use returned `credential` in-memory for the immediate operation.
5. Do not persist, cache long-term, or re-log returned plaintext.

Forbidden pattern:

- Direct calls from feature services to secret persistence adapters, encryption ports, or legacy environment-variable fallback reads for runtime credentials.

## Authorization and auditing expectations

Every secret operation and plaintext retrieval is expected to flow through policy and audit seams.

- Use cases already enforce permission checks and scope-owner compatibility.
- Retrieval calls must include a concrete `operationKey` and meaningful justification context.
- Authorization denials are expected behavior and should map to explicit feature-level failure states instead of retries with wider scope.
- Do not bypass audit emission by adding side-channel credential loading paths.

## Rotation behavior and consumer assumptions

Feature modules must treat rotation as active-version substitution handled by the secret service.

- Rotation creates a new version and activates it as `currentVersionId`.
- Prior active versions are retained for lineage/audit metadata only.
- Runtime retrieval always resolves the active version only.
- Concurrency-safe rotation should use `expectedCurrentVersionId` when an operation depends on a specific active version.

Consumer guidance:

- Never pin downstream logic to historical version IDs unless implementing explicit administrative workflows.
- On `secret-conflict` during rotate/update flows, reload metadata and retry with user/operator confirmation.

## Clean architecture boundaries for new feature work

- Domain layer: no storage, transport, or secret-retrieval orchestration logic.
- Application layer: declare ports/use-case dependencies and perform policy-aware orchestration.
- Infrastructure layer: adapt transport/runtime/host concerns to application secret contracts.
- Presentation layer: collect inputs and display metadata/outcomes; never hold long-lived plaintext state.

## Contributor checklist for secret-backed features

Before merging a secret-backed feature, confirm:

- scope owner choice is explicit (`server`/`workspace`/`user`) and validated.
- runtime retrieval uses secret adapters/use cases, not ad hoc config/env access.
- transport/query DTOs do not expose plaintext/ciphertext internals.
- logs, diagnostics, and audit details remain redaction-safe.
- authorization-denied and policy-violation paths are explicitly handled.
- rotation/conflict behavior is documented in feature flow or operator guidance.

## Related docs

- `docs/architecture/secrets-foundation.md`
- `docs/architecture/secrets-service-consumption-adapters.md`
- `docs/architecture/secrets-redaction-and-logging-safeguards.md`
- `docs/architecture/secrets-rotation-and-version-activation-workflows.md`
- `docs/secret-bootstrap-and-migration-operations.md`
- `docs/secret-health-and-operational-diagnostics.md`
