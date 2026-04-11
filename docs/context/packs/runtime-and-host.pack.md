# Runtime and Host Pack

## Purpose

- Provide compact, authoritative context for runtime, host, desktop, and startup implementation or diagnostics work.
- Keep host/runtime tasks grounded in startup boundaries, host authority rules, and desktop post-login runtime lifecycle contracts.

## When To Use

- Diagnosing host startup regressions, runtime readiness failures, or desktop post-login warmup issues.
- Implementing changes under `src/hosts`, `electron/main`, or runtime startup orchestration seams.
- Reviewing or changing host lifecycle coordination, host bootstrap stages, and startup configuration resolution.
- Troubleshooting runtime dependency/service-supervisor behavior that affects desktop host execution.

## When Not To Use

- Broad architecture reviews not centered on runtime/host startup or lifecycle seams.
- UI-only interaction or workflow experience updates that do not change host/runtime behavior.
- Security-policy-only changes where runtime/host startup composition is not touched.
- Runbook-style operational incident response procedures.

## Invariants

- Preserve host authority boundaries: authoritative control-plane ownership remains server-host scoped.
- Keep startup orchestration host-owned and stage-driven through shared bootstrap/lifecycle contracts.
- Do not move domain or application policy into host bootstrap, desktop main-process wiring, or runtime adapters.
- Keep desktop startup split explicit: pre-login auth-first shell before post-login runtime warmup/deferred features.
- Runtime diagnostics and readiness states must remain explicit; avoid collapsing into binary healthy/unhealthy shortcuts.

## Authoritative Docs

- `docs/architecture/host-runtime-composition-boundaries.md`
- `docs/architecture/host-bootstrap-pipeline.md`
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/desktop-host-assembly.md`
- `docs/architecture/desktop-auth-first-startup-boundary.md`
- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`
- `docs/architecture/auth-only-server-startup-contract.md`
- `docs/architecture/desktop-runtime-and-hosts.md`

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

- Bypassing host composition roots with ad hoc startup paths or direct runtime process mutations.
- Mixing pre-login auth-shell startup and post-login runtime warmup responsibilities in one opaque flow.
- Treating desktop host as authoritative control-plane owner.
- Shipping runtime fixes without targeted host/runtime startup regression tests.
- Using broad repository context when runtime-host-specific contracts already cover the task.

## Related Packs

- `repository-overview`: load first for baseline repository orientation before runtime-host depth.
- `architecture-core`: combine for cross-layer boundary checks when host changes affect application/domain seams.
- `context-system-foundations`: add when changing routing maps, context-pack metadata, or context governance assets.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.md`
2. `docs/context/packs/architecture-core.pack.md`
3. `docs/context/packs/runtime-and-host.pack.md`
4. Task-matched startup docs (auth-first boundary, post-login lifecycle, host bootstrap pipeline)
5. Runtime/host implementation paths under `src/hosts` and `electron/main`

## Change Triggers

- Host bootstrap stage-order or lifecycle contract changes.
- Desktop startup boundary changes (auth-first shell, post-login warmup, deferred runtime registration).
- Host authority/capability model changes in host runtime catalogs or composition roots.
- Runtime startup diagnostics model updates that change readiness state or remediation semantics.
