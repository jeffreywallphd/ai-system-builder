# Transport and Runtime Availability Pack

## Purpose

- Provide focused guidance for deferred API readiness gating, transport lifecycle handling, and truthful degraded-runtime behavior.
- Keep runtime availability semantics explicit across desktop, browser fallback, and capability-gated API surfaces.

## When To Use

- Changing runtime readiness/availability contracts or deferred feature API gating behavior.
- Updating transport lifecycle state transitions, unavailability handling, retryability, or fallback semantics.
- Diagnosing runtime unavailable/degraded states that impact endpoint behavior or user-facing truthfulness.

## When Not To Use

- Startup stage composition tasks that do not change transport/readiness contracts.
- Persistence model refactors with no runtime-availability or endpoint-state behavior changes.
- UI-only styling or local interaction work.

## Invariants

- Deferred or phase-dependent APIs must remain explicitly guarded until runtime is truly ready.
- Runtime/transport availability must be stateful and contract-driven, not inferred from connection-refusal side effects.
- Unavailable/degraded responses must preserve truthful reason codes, retryability, and diagnostics posture.
- Fallback behavior must stay explicit and boundary-safe; browser/degraded paths must not masquerade as full desktop runtime truth.
- Capability and readiness categories must remain semantically meaningful and test-verifiable.

## Authoritative Docs

- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`
- `docs/architecture/desktop-renderer-startup-boundary.md`
- `docs/architecture/post-login-runtime-deferral-boundary.md`
- `docs/architecture/unified-api-authoritative-surface.md`
- `docs/architecture/domains/api-and-transport-surfaces/references/unified-api-surface-contracts.md`
- `docs/unified-api-observability-troubleshooting.md`

## Authoritative Code Paths

- `src/application/common/DesktopControlPlaneRuntimeContracts.ts`
- `src/shared/contracts/runtime/RuntimeAvailabilityResponseContracts.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/ui/runtime/DesktopPostLoginWarmup.ts`
- `src/ui/runtime/DeferredRuntimeFeatureGate.ts`
- `src/ui/shared/api/SharedApiClient.ts`

## Anti-Patterns

- Treating deferred feature endpoints as always available after login.
- Using transport failures as implicit readiness signaling instead of explicit runtime contracts.
- Hiding degraded runtime paths behind optimistic success states.
- Returning desktop-equivalent capability claims from browser/degraded fallback paths.

## Related Packs

- `repository-overview`
- `runtime-and-host`
- `startup-and-host-promotion`
- `observability-and-readiness`
- `storage-persistence-and-materialization`
