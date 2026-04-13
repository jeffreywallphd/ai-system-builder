# AI Companion: Transport and Runtime Availability Pack

## Purpose

- Focused guidance for deferred API readiness gating, transport lifecycle handling, and truthful degraded-runtime behavior.
- Keep runtime availability semantics explicit across desktop, browser fallback, and capability-gated API surfaces.

## When To Use

- Changing runtime readiness/availability contracts or deferred feature API gating behavior.
- Updating transport lifecycle state transitions, unavailability handling, retryability, or fallback semantics.
- Diagnosing runtime unavailable/degraded states that impact endpoint behavior or user-facing truthfulness.

## When Not To Use

- Startup stage composition tasks with no transport/readiness contract changes.
- Persistence model refactors with no runtime-availability or endpoint-state behavior impact.
- UI-only styling or local interaction-only work.

## Invariants

- Phase-dependent APIs remain explicitly guarded until runtime is truly ready.
- Availability remains stateful/contract-driven, not inferred from connection-refusal side effects.
- Unavailable/degraded responses keep explicit reason codes, retryability, and diagnostics posture.
- Fallback paths stay explicit and boundary-safe; browser/degraded flows must not masquerade as full desktop truth.
- Capability/readiness categories remain semantically meaningful and test-verifiable.

## Authoritative Docs

- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.ai.md`
- `docs/architecture/desktop-renderer-startup-boundary.md`
- `docs/architecture/post-login-runtime-deferral-boundary.ai.md`
- `docs/architecture/unified-api-authoritative-surface.ai.md`
- `docs/architecture/domains/api-and-transport-surfaces/references/unified-api-surface-contracts.ai.md`
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
- Using transport failures as implicit readiness signals instead of explicit runtime contracts.
- Hiding degraded runtime paths behind optimistic success semantics.
- Returning desktop-equivalent capability claims from browser/degraded fallback paths.

## Related Packs

- `repository-overview`
- `runtime-and-host`
- `startup-and-host-promotion`
- `observability-and-readiness`
- `storage-persistence-and-materialization`
