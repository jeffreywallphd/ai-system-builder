# Core Architecture Pack

## Purpose

- Provide compact, architecture-first guidance for design and implementation tasks that touch layered boundaries, host composition, or cross-domain interactions.
- Keep architecture-sensitive work grounded in current canonical repository contracts without loading every feature architecture document.

## When To Use

- Architecture reviews, migration/refactor planning, or coding tasks that cross `src/domain`, `src/application`, `src/infrastructure`, `src/hosts`, or `src/ui`.
- Work that can introduce boundary regressions (for example, host startup changes, transport/API shaping, or cross-layer orchestration changes).
- Decomposition tasks where architecture invariants must drive slice boundaries.

## When Not To Use

- Context-contract maintenance inside `docs/context` where `context-system-foundations` is the primary pack.
- Narrow feature work that is fully bounded to one domain pack (for example, only secrets internals or only audit event taxonomy).
- Runbook-style operational troubleshooting.

## Invariants

- Preserve architecture direction: `domain -> application -> infrastructure/hosts/ui integration`.
- Keep business rules and validation in domain/application seams; UI, transport, and host layers stay composition/adaptation-focused.
- Treat the authoritative server host as the control-plane authority; desktop and worker hosts are non-authoritative runtime shells.
- Keep canonical contracts in docs and tests aligned when architecture behavior changes.
- Prefer extending existing ports/contracts over introducing parallel runtime or persistence models.

## Authoritative Docs

- `docs/architecture/README.md`
- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/layers-and-boundaries.md`
- `docs/architecture/workflow-execution-and-tools.md`
- `docs/architecture/desktop-host-assembly.md`
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/worker-host-assembly.md`
- `docs/architecture/studio-handoff-contract.md`

## Authoritative Code Paths

- `src/domain`
- `src/application`
- `src/infrastructure`
- `src/hosts`
- `src/ui/routes/StudioHandoffContract.ts`
- `dev/tests/HostCompositionArchitectureGuardrails.test.ts`
- `dev/tests/ArchitectureDocsRoutingIntegrity.test.ts`

## Anti-Patterns

- Moving domain/application policy into UI services, host entrypoints, or transport handlers.
- Bypassing application ports/use cases with direct infrastructure calls from outer layers.
- Treating long historical "Direction" update sections as current source-of-truth contracts when canonical architecture docs disagree.
- Adding new runtime/persistence paths that duplicate existing host composition seams.

## Related Packs

- `repository-overview`: load first for repository-level orientation before architecture-deep guidance.
- `runtime-and-host`: combine when architecture work is primarily host/runtime startup, lifecycle, or desktop-boundary focused.
- `context-system-foundations`: add when architecture work also changes context contracts, routing maps, or governance assets.

## Retrieval Order

1. `docs/context/packs/architecture-core.pack.md`
2. `docs/architecture/README.md`
3. `docs/architecture/layers-and-boundaries.md`
4. Task-surface architecture docs matched to `changedPaths` (host assembly, workflow execution, studio handoff).

## Change Triggers

- Layer boundary contract changes in `docs/architecture/domain-and-application-core.md` or `docs/architecture/layers-and-boundaries.md`.
- Host authority or startup composition contract changes in host assembly docs.
- New canonical architecture router links that should replace current references.
- Architecture guardrail test updates that change expected boundary behavior.
