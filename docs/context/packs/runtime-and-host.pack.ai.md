# AI Companion: Runtime and Host Pack

## Purpose

- Compact authoritative context for runtime, host, desktop, and startup implementation/diagnostics work.
- Keep host/runtime tasks anchored to startup boundaries, host authority contracts, and desktop post-login lifecycle rules.

## When To Use

- Diagnosing host startup regressions, runtime readiness failures, or desktop post-login warmup faults.
- Implementing behavior changes in `src/hosts`, `electron/main`, or runtime startup orchestration seams.
- Updating host lifecycle coordination, bootstrap stage composition, or startup configuration resolution.
- Troubleshooting runtime dependency/service-supervisor issues that impact desktop host execution.

## When Not To Use

- Architecture tasks not centered on runtime/host startup and lifecycle seams.
- UI-only workflow/experience changes without host/runtime behavior impact.
- Security-policy-only work that does not touch host/runtime startup composition.
- Procedure-level operational runbooks.

## Invariants

- Preserve host authority: authoritative control-plane ownership remains server-host scoped.
- Keep startup orchestration host-owned and stage-driven through shared bootstrap/lifecycle seams.
- Keep domain/application policy out of host bootstrap and runtime adapter wiring.
- Preserve explicit startup split: pre-login auth-first shell then post-login runtime warmup/deferred features.
- Keep runtime readiness and diagnostics states explicit; avoid binary oversimplification.

## Authoritative Docs

- `docs/architecture/host-runtime-composition-boundaries.ai.md`
- `docs/architecture/host-bootstrap-pipeline.ai.md`
- `docs/architecture/authoritative-server-host-assembly.ai.md`
- `docs/architecture/desktop-host-assembly.ai.md`
- `docs/architecture/desktop-auth-first-startup-boundary.ai.md`
- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.ai.md`
- `docs/architecture/auth-only-server-startup-contract.ai.md`
- `docs/architecture/desktop-runtime-and-hosts.ai.md`

## Authoritative Code Paths

- `src/hosts/bootstrap/HostBootstrapPipeline.ts`
- `src/hosts/lifecycle/HostLifecycleCoordinator.ts`
- `src/hosts/desktop/DesktopHostCompositionRoot.ts`
- `src/hosts/desktop/DesktopHostEntrypoint.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/infrastructure/config/HostStartupConfiguration.ts`
- `electron/main/main.ts`
- `electron/main/runtime/PostLoginRuntimeBootstrapper.ts`
- `electron/main/DesktopServiceSupervisor.ts`
- `dev/tests/HostCompositionArchitectureGuardrails.test.ts`
- `dev/tests/HostDevelopmentStartupScripts.test.ts`

## Anti-Patterns

- Bypassing composition roots with ad hoc startup paths or direct runtime process mutation.
- Blending pre-login auth startup and post-login runtime warmup into one opaque startup flow.
- Treating desktop host as authoritative control-plane owner.
- Landing runtime fixes without targeted startup/regression coverage.
- Loading broad unrelated repository context when runtime-host contracts already satisfy the task.

## Related Packs

- `repository-overview`: load first for baseline repository orientation.
- `architecture-core`: combine for cross-layer boundary checks when host/runtime changes touch inner layers.
- `context-system-foundations`: add when editing routing maps, context-pack metadata, or governance assets.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.ai.md`
2. `docs/context/packs/architecture-core.pack.ai.md`
3. `docs/context/packs/runtime-and-host.pack.ai.md`
4. Task-matched startup docs (auth-first boundary, post-login lifecycle, bootstrap pipeline)
5. Runtime/host implementation paths under `src/hosts` and `electron/main`

## Change Triggers

- Bootstrap stage-order or lifecycle contract updates.
- Desktop startup boundary changes (auth-first shell, post-login warmup, deferred runtime registration).
- Host authority/capability model changes in runtime catalogs/composition roots.
- Runtime diagnostics/readiness model updates that change state semantics or remediation guidance.
