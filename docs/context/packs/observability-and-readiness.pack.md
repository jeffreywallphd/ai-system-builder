# Observability and Readiness Pack

## Purpose

- Provide focused guardrails for startup/readiness checkpoints, lifecycle diagnostics, and truthful runtime observability.
- Keep diagnostics treated as architecture-maintenance contracts, not optional debug noise.

## When To Use

- Changing readiness checkpoints, runtime lifecycle diagnostics, or startup instrumentation semantics.
- Updating transport/server observability events, redaction behavior, or correlation contracts.
- Diagnosing availability regressions where truthful diagnostics are required to preserve runtime boundary behavior.

## When Not To Use

- Pure feature behavior changes with no readiness/diagnostic contract impact.
- Storage schema or persistence-only changes without observability implications.
- UI-only cosmetic updates.

## Invariants

- Readiness checkpoints must remain explicit at pre-login, post-login warmup, and deferred-runtime activation boundaries.
- Operational diagnostics must be structured, correlated, and redacted; unsafe leakage is a regression.
- Runtime blocking states and degraded paths must emit truthful machine-readable diagnostics.
- Observability signals must preserve boundary semantics (for example, unavailable vs warming vs failed), not flatten them.
- Instrumentation changes must keep diagnostics auditable across desktop/runtime transport surfaces.

## Authoritative Docs

- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`
- `docs/architecture/deployment-profile-policy-admin-observability-redaction-and-failure-handling.md`
- `docs/architecture/run-orchestration-scheduling-observability-metrics-and-redaction.md`
- `docs/architecture/audit-observability-failure-handling-and-redaction-safeguards.md`
- `docs/unified-api-observability-troubleshooting.md`

## Authoritative Code Paths

- `electron/main/runtime/PostLoginRuntimeActivationService.ts`
- `src/shared/contracts/runtime/RuntimeAvailabilityResponseContracts.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/ui/shared/api/SharedApiClient.ts`
- `src/ui/services/IdentityAuthService.ts`

## Anti-Patterns

- Removing readiness checkpoints because startup still appears to work locally.
- Logging sensitive payloads or unredacted secrets in runtime/transport diagnostics.
- Emitting vague success/failure-only states that hide degraded or blocked readiness conditions.
- Treating diagnostics contracts as optional and leaving failure paths uninstrumented.

## Related Packs

- `repository-overview`
- `runtime-and-host`
- `startup-and-host-promotion`
- `transport-and-runtime-availability`
- `storage-persistence-and-materialization`
