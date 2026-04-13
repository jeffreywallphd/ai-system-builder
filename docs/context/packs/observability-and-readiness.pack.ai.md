# AI Companion: Observability and Readiness Pack

## Purpose

- Focused guardrails for startup/readiness checkpoints, lifecycle diagnostics, and truthful runtime observability.
- Keep diagnostics treated as architecture-maintenance contracts, not optional debug noise.

## When To Use

- Changing readiness checkpoints, runtime lifecycle diagnostics, or startup instrumentation semantics.
- Updating transport/server observability events, redaction behavior, or correlation contracts.
- Diagnosing availability regressions where truthful diagnostics must preserve runtime boundary behavior.

## When Not To Use

- Pure feature behavior changes with no readiness/diagnostic contract impact.
- Storage schema or persistence-only changes without observability implications.
- UI-only cosmetic updates.

## Invariants

- Keep readiness checkpoints explicit at pre-login, post-login warmup, and deferred activation boundaries.
- Keep diagnostics structured, correlated, and redacted; unsafe leakage is regression.
- Keep runtime blocking/degraded states machine-readable and truthful.
- Preserve boundary semantics (`unavailable`, `warming`, `ready`, `failed`) instead of flattening status.
- Keep instrumentation auditable across desktop/runtime transport surfaces.

## Authoritative Docs

- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.ai.md`
- `docs/architecture/deployment-profile-policy-admin-observability-redaction-and-failure-handling.ai.md`
- `docs/architecture/run-orchestration-scheduling-observability-metrics-and-redaction.ai.md`
- `docs/architecture/audit-observability-failure-handling-and-redaction-safeguards.ai.md`
- `docs/unified-api-observability-troubleshooting.md`

## Authoritative Code Paths

- `electron/main/runtime/PostLoginRuntimeActivationService.ts`
- `src/shared/contracts/runtime/RuntimeAvailabilityResponseContracts.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/ui/shared/api/SharedApiClient.ts`
- `src/ui/services/IdentityAuthService.ts`

## Anti-Patterns

- Removing readiness checkpoints because local startup still appears to work.
- Logging sensitive payloads or unredacted secrets in diagnostics.
- Emitting vague success/failure-only statuses that hide degraded or blocked readiness states.
- Treating diagnostics contracts as optional and leaving failure paths uninstrumented.

## Related Packs

- `repository-overview`
- `runtime-and-host`
- `startup-and-host-promotion`
- `transport-and-runtime-availability`
- `storage-persistence-and-materialization`
