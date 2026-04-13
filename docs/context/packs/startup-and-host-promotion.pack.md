# Startup and Host Promotion Pack

## Purpose

- Provide focused guardrails for desktop/auth-minimal/post-login startup sequencing and host-promotion boundaries.
- Preserve explicit control-plane authority boundaries during startup composition, promotion, rollback, and teardown.

## When To Use

- Changing startup sequencing across pre-login auth shell, post-login warmup, or host lifecycle promotion.
- Refactoring host composition roots, startup stage ownership, or startup cleanup/rollback behavior.
- Reviewing changes that could blur authoritative host ownership or collapse startup phases.

## When Not To Use

- Pure transport/API contract changes without startup sequencing impact.
- Storage-only or persistence-only tasks that do not touch host startup lifecycle.
- UI-only route and component behavior work.

## Invariants

- Keep pre-login auth-shell startup, post-login warmup, and feature-first activation as explicit lifecycle boundaries.
- Keep authoritative control-plane ownership server-host scoped; desktop host remains a non-authoritative runtime shell.
- Keep host promotion/composition stage-driven and reversible with deterministic cleanup on startup failure.
- Do not re-introduce deferred runtime groups into pre-login startup critical path.
- Keep startup guardrails and lifecycle-state diagnostics explicit when startup contracts evolve.

## Authoritative Docs

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/architecture/auth-only-server-startup-contract.md`
- `docs/architecture/desktop-auth-first-startup-boundary.md`
- `docs/architecture/post-login-runtime-deferral-boundary.md`
- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`
- `docs/architecture/host-bootstrap-pipeline.md`
- `docs/architecture/host-runtime-composition-boundaries.md`

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
- Adding startup paths that skip lifecycle coordinator cleanup/rollback semantics.

## Related Packs

- `repository-overview`
- `architecture-core`
- `runtime-and-host`
- `transport-and-runtime-availability`
- `observability-and-readiness`
