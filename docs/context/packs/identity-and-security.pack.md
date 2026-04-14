# Identity and Security Pack

## Purpose

- Provide compact, authoritative context for identity, authentication, authorization, trust, and security-sensitive changes.
- Keep security-sensitive tasks anchored to explicit contracts so implementation work does not weaken trust, redaction, or policy boundaries.

## When To Use

- Implementing or reviewing changes under identity/authentication, authorization policy evaluation, trusted-device workflows, transport trust, or secrets handling.
- Editing security-sensitive API routes, session issuance/validation, permission enforcement, or trusted-node admission flows.
- Investigating regressions where access control, credential handling, trust material, or redaction posture may be impacted.

## When Not To Use

- UI-only experience work with no identity, policy, or trust boundary changes.
- Generic architecture decomposition where security-sensitive constraints are not in scope.
- Operational incident runbooks and response sequencing.

## Invariants

- Identity proof, session trust, and authorization evaluation remain separate concerns; do not collapse them into one broad "auth" step.
- Authorization decisions must remain explicit, auditable, and deny-by-default when policy context is missing.
- Trusted-device and node-trust flows must preserve cryptographic trust establishment and revocation semantics.
- Secrets and protected values must stay out of logs and telemetry except approved redacted metadata.
- Security-sensitive routes and mutation surfaces must keep least-privilege and role/permission boundary checks explicit.
- Authorization diagnostics must use canonical reason-code/provenance catalogs, preserve correlation continuity, and enforce external redaction boundaries.

## Authoritative Docs

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/architecture/authorization-foundation.md`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/unified-api-observability-troubleshooting.md`
- `docs/architecture/trusted-device-foundation.md`
- `docs/architecture/transport-security-foundation.md`
- `docs/architecture/secrets-foundation.md`
- `docs/architecture/secrets-redaction-and-logging-safeguards.md`
- `docs/architecture/node-trust-foundation.md`
- `docs/architecture/auth-only-server-startup-contract.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`

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

- Treating a successful login as full authorization to all resource mutations.
- Adding authorization bypasses for "internal-only" routes without explicit policy contracts.
- Returning raw secrets, credentials, or trust material in API responses, logs, or error payloads.
- Coupling trust bootstrap and runtime request authorization into ad hoc checks that bypass shared services.
- Performing security-sensitive refactors without targeted authorization/identity/trust regression tests.

## Related Packs

- `repository-overview`: load first for broad architecture orientation.
- `architecture-core`: combine when security work crosses layered boundaries or host composition seams.
- `runtime-and-host`: add when security changes touch startup/runtime trust orchestration.
- `context-system-foundations`: add when editing routing contracts, pack metadata, or governance artifacts.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.md`
2. `docs/context/packs/architecture-core.pack.md`
3. `docs/context/packs/identity-and-security.pack.md`
4. Task-specific security docs (`authorization-*`, `transport-security-*`, `secrets-*`, `trusted-device-*`, `node-trust-*`)
5. Security-sensitive implementation paths under `src/application`, `src/infrastructure/security`, and identity route families

## Change Triggers

- Identity/session/trusted-device contract changes.
- Authorization role/permission model or policy-evaluation contract changes.
- Transport trust, secrets redaction, or trust-material lifecycle contract changes.
- New security-sensitive route families or persistence seams that become authoritative editing surfaces.
