# Secret-Backed Feature Contributor Guide

This guide defines the contributor workflow for building or extending secret-backed platform behavior under the hardened security-material model.

## When to use this guide

Use this document when a change introduces or modifies:

- provider credentials,
- signing material,
- encryption material,
- certificate/trust references, or
- startup/diagnostics behavior that depends on secret governance policy.

## Prerequisites and local setup

1. Configure secret envelope encryption:
   - `AI_LOOM_SECRET_MASTER_KEY_ID`
   - `AI_LOOM_SECRET_MASTER_KEY`
2. Configure required bootstrap IDs where applicable:
   - `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`
3. Optional migration window controls:
   - `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV`
   - temporary legacy env values (`OPENAI_API_KEY`, `HUGGINGFACE_API_TOKEN`, `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY`)
4. Start host and verify:
   - `GET /api/v1/security/secrets/health`
   - `GET /api/v1/security/secrets/diagnostics` (trusted session)

If health is degraded/unhealthy, resolve diagnostics before adding new dependent runtime behavior.

## Scope and ownership rules

Choose scope by ownership, not caller convenience:

- `server`: control-plane level material
- `workspace`: shared integration credentials for one workspace
- `user`: personal credentials for one user identity

Never collapse user/workspace material into server scope to bypass authorization or setup friction.

## Startup policy expectations

- production-capable startup must satisfy fail-fast-required material with durable configured values
- development/test may permit optional warning-only behavior when classification policy allows it
- deterministic development fallback for critical server material is allowed only when startup validation policy marks it eligible
- obsolete random runtime fallback behavior is not an accepted implementation pattern

## Adding a new secret consumer

1. Define classification + hierarchy metadata in application/security contracts.
2. Decide startup requirement and lifecycle policy (`default`, `development`, `test`).
3. Route runtime retrieval through scoped provider retrieval (`ScopedSecretProviderMaterialRetrievalUseCase`, `ServerPlatformSecretConsumers`, or `ISecretProviderMaterialResolutionPort`).
4. Keep transport/query outputs metadata-only; plaintext only in mutation commands.
5. Add or update diagnostics mapping and ensure redaction-safe logs/audit details.
6. Add tests for:
   - scope authorization
   - production fail-fast behavior
   - development/test warning behavior when applicable

## Adding a new provider backend

1. Implement required `ISecretProviderMaterialResolutionPort` operations for intended scopes:
   - material read
   - metadata read
   - existence checks
   - bootstrap create
2. Emit `SecretProviderMaterialMetadata` with backend identity, rotation metadata, and policy flags.
3. Integrate backend routing in `DefaultSecretProviderResolutionService` without breaking scope boundaries.
4. Preserve audit and redaction guarantees; never return/log plaintext outside dedicated retrieval flows.
5. Extend diagnostics to expose backend kind safely (metadata only).

## Safe implementation constraints

- no direct runtime env secret reads in feature services for governed material
- no direct persistence adapter reads in place of authorized secret retrieval flows
- no plaintext in list/detail/diagnostic DTOs
- explicit handling for `forbidden`, `conflict`, `not-found`, and policy-denied outcomes
- rotation-aware behavior must treat active version as default and use explicit compatibility flows for superseded versions

## Contributor review checklist

Before opening a PR:

- scope ownership rationale is explicit
- startup policy impact is documented
- diagnostics impact is documented
- redaction/audit posture is preserved
- required docs are updated (`architecture`, `operations`, contributor guidance as needed)
- regression tests cover new consumer/backend seams and policy outcomes

## Related references

- `docs/architecture/security-critical-runtime-material-inventory.md`
- `docs/architecture/secrets-foundation.md`
- `docs/architecture/secrets-feature-extension-guidance.md`
- `docs/secret-bootstrap-and-migration-operations.md`
- `docs/secret-health-and-operational-diagnostics.md`

