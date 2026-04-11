# AI Companion: Identity and Security Pack

## Purpose

- Compact authoritative context for identity, authentication, authorization, trust, and security-sensitive changes.
- Keep security-sensitive work anchored to explicit contracts so trust, redaction, and policy boundaries remain intact.

## When To Use

- Implementing/reviewing identity auth, authorization policy, trusted-device, transport trust, or secrets behavior.
- Editing security-sensitive API routes, session issuance/validation, permission enforcement, or trusted-node admission.
- Debugging regressions that may affect access control, credential handling, trust material, or redaction posture.

## When Not To Use

- UI-only behavior changes without identity/policy/trust impact.
- Broad architecture planning where security constraints are not in scope.
- Procedure-level operational runbooks.

## Invariants

- Keep identity proof, session trust, and authorization evaluation separate; do not collapse into one "auth" step.
- Keep authorization explicit, auditable, and deny-by-default when policy context is missing.
- Preserve trusted-device and node-trust cryptographic trust establishment/revocation semantics.
- Never expose secrets/protected values in logs, telemetry, or API payloads beyond approved redacted metadata.
- Keep least-privilege and role/permission checks explicit on security-sensitive routes and mutations.

## Authoritative Docs

- `docs/architecture/authorization-foundation.ai.md`
- `docs/architecture/authorization-enforcement-integration-patterns.ai.md`
- `docs/architecture/trusted-device-foundation.ai.md`
- `docs/architecture/transport-security-foundation.ai.md`
- `docs/architecture/secrets-foundation.ai.md`
- `docs/architecture/secrets-redaction-and-logging-safeguards.ai.md`
- `docs/architecture/node-trust-foundation.ai.md`
- `docs/architecture/auth-only-server-startup-contract.ai.md`

## Authoritative Code Paths

- `src/application/identity`
- `src/application/authorization`
- `src/application/nodes/use-cases/ResolveApprovedNodeRuntimeTrustMaterialUseCase.ts`
- `src/infrastructure/security/identity`
- `src/infrastructure/security/secrets`
- `src/infrastructure/transport/http-server/identity`
- `src/infrastructure/transport/authorization`
- `src/infrastructure/persistence/identity`
- `src/infrastructure/persistence/authorization`
- `src/infrastructure/persistence/security`
- `src/infrastructure/security/tests/TransportSecurityObservabilityReporter.test.ts`

## Anti-Patterns

- Treating successful login as blanket authorization.
- Adding "internal-only" authorization bypasses without explicit policy contracts.
- Returning raw secrets/credentials/trust material in responses, logs, or errors.
- Mixing trust bootstrap and runtime authorization in ad hoc checks that bypass shared services.
- Landing security-sensitive refactors without targeted authorization/identity/trust regression coverage.

## Related Packs

- `repository-overview`: load first for baseline orientation.
- `architecture-core`: combine when security work crosses layered or host-composition seams.
- `runtime-and-host`: add when security changes touch startup/runtime trust orchestration.
- `context-system-foundations`: add when editing routing contracts, pack metadata, or governance assets.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.ai.md`
2. `docs/context/packs/architecture-core.pack.ai.md`
3. `docs/context/packs/identity-and-security.pack.ai.md`
4. Task-specific security docs (`authorization-*`, `transport-security-*`, `secrets-*`, `trusted-device-*`, `node-trust-*`)
5. Security-sensitive implementation paths under `src/application`, `src/infrastructure/security`, and identity route families

## Change Triggers

- Identity/session/trusted-device contract updates.
- Authorization role/permission or policy-evaluation contract updates.
- Transport trust, secrets redaction, or trust-material lifecycle contract updates.
- New security-sensitive route families or persistence seams becoming authoritative edit surfaces.
