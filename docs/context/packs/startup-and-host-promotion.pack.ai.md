# AI Companion: Startup and Host Promotion Pack

## Purpose

- Focused guardrails for desktop/auth-minimal/post-login startup sequencing and host-promotion boundaries.
- Preserve explicit control-plane authority boundaries during startup composition, promotion, rollback, and teardown.

## When To Use

- Changing startup sequencing across pre-login auth shell, post-login warmup, or host lifecycle promotion.
- Refactoring host composition roots, startup stage ownership, or startup cleanup/rollback behavior.
- Reviewing changes that could blur authoritative host ownership or collapse startup phases.

## When Not To Use

- Transport/API contract changes without startup sequencing impact.
- Storage-only/persistence-only work with no host startup lifecycle impact.
- UI-only route/component behavior tasks.

## Invariants

- Preserve explicit lifecycle boundaries: pre-login auth shell, post-login warmup, feature-first activation.
- Keep authoritative control-plane ownership server-host scoped; desktop host remains non-authoritative.
- Keep promotion/composition stage-driven and reversible with deterministic startup failure cleanup.
- Do not move deferred runtime groups back into pre-login critical path.
- Keep startup guardrails and lifecycle diagnostics explicit as contracts evolve.

## Authoritative Docs

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/architecture/auth-only-server-startup-contract.ai.md`
- `docs/architecture/desktop-auth-first-startup-boundary.ai.md`
- `docs/architecture/post-login-runtime-deferral-boundary.ai.md`
- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.ai.md`
- `docs/architecture/host-bootstrap-pipeline.ai.md`
- `docs/architecture/host-runtime-composition-boundaries.ai.md`

## Authoritative Code Paths

- `electron/main/main.ts`
- `electron/main/runtime/PostLoginRuntimeActivationService.ts`
- `electron/main/runtime/PostLoginRuntimeDependencyActivator.ts`
- `src/hosts/bootstrap/HostBootstrapPipeline.ts`
- `src/hosts/lifecycle/HostLifecycleCoordinator.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `dev/tests/HostDevelopmentStartupScripts.test.ts`

## Anti-Patterns

- Collapsing pre-login and post-login responsibilities into one startup flow.
- Treating deferred startup capability groups as pre-login requirements.
- Promoting desktop/runtime composition into control-plane authority ownership.
- Adding startup paths that bypass lifecycle cleanup/rollback contracts.

## Related Packs

- `repository-overview`
- `architecture-core`
- `runtime-and-host`
- `transport-and-runtime-availability`
- `observability-and-readiness`
