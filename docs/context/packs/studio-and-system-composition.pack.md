# Studio and System Composition Pack

## Purpose

- Provide a bounded, architecture-aligned context pack for studio and system composition work.
- Keep Studio Shell, System Studio, workflow handoff, and asset composition tasks grounded in current canonical contracts.
- Prevent UI-first assumptions from overriding domain/application/system composition truth.

## When To Use

- Designing or refactoring Studio Shell and System Studio interaction flows.
- Decomposing features that cross `src/ui/studio-shell`, `src/application/system-studio`, `src/application/workflow-studio`, and handoff seams.
- Reviewing changes to asset-selector launch/return contracts, studio return payload handling, or cross-studio context transfer.
- Planning studio/system composition slices where system assets, workflow bindings, and UI flows must remain aligned.

## When Not To Use

- Runtime host/bootstrap diagnostics where `runtime-and-host` is primary.
- Context-contract/routing governance edits where `context-system-foundations` is primary.
- Narrow non-studio domain implementation tasks with no Studio Shell or system composition impact.
- Runbook or incident response procedures.

## Invariants

- Preserve architecture direction: `domain -> application -> infrastructure/hosts/ui integration`; studio pages do not become policy authorities.
- Keep system composition authoritative in domain/application contracts; UI shells project and orchestrate, not redefine.
- Use canonical handoff/return contracts for cross-studio launch and resume behavior; avoid ad hoc query semantics.
- Keep workflow/system separation explicit: workflows define reusable execution contracts, systems bind reusable runnable configurations.
- Prefer shared selector/session/composition seams over feature-local duplicate flow logic.

## Authoritative Docs

- `docs/architecture/studio-handoff-contract.md`
- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-manipulation-studio-interaction-model.md`
- `docs/architecture/asset-selector-framework.md`
- `docs/architecture/shared-composition-taxonomy.md`
- `docs/architecture/multi-surface-ui-composition-foundation.md`
- `docs/ui/README.md`

## Authoritative Code Paths

- `src/ui/routes/StudioHandoffContract.ts`
- `src/ui/routes/StudioReturnPayloadResolution.ts`
- `src/ui/studio-shell/asset-selector`
- `src/ui/studio-shell/workflow`
- `src/application/studio-handoff`
- `src/application/system-studio`
- `src/application/workflow-studio`
- `src/domain/system-studio`
- `src/domain/studio-handoff`
- `src/domain/systems`
- `dev/tests/MultiSurfaceUiArchitectureDocumentationGuardrails.test.ts`

## Anti-Patterns

- Treating studio routes/components as the source of truth for workflow/system contracts.
- Collapsing workflow definitions and system definitions into a single mutable UI model.
- Implementing cross-studio launch/return with one-off query params outside canonical handoff contracts.
- Reintroducing feature-local selector/session orchestration when shared selector framework seams already exist.
- Mixing runtime-host startup assumptions into studio/system composition design without contract evidence.

## Related Packs

- `repository-overview`: load first for repository-wide orientation and baseline boundaries.
- `architecture-core`: combine when studio/system changes cross architecture seams beyond UI composition.
- `runtime-and-host`: add when studio/system work includes startup/runtime lifecycle behavior.
- `context-system-foundations`: add when changing context routing, pack metadata, or governance assets.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.md`
2. `docs/context/packs/architecture-core.pack.md`
3. `docs/context/packs/studio-and-system-composition.pack.md`
4. `docs/architecture/studio-handoff-contract.md`
5. `docs/architecture/image-workflow-system-definition-layer.md`
6. `docs/ui/README.md`

## Change Triggers

- Studio handoff/return contract field or lifecycle changes.
- New or renamed Studio Shell/System Studio authoritative docs or code seams.
- Workflow/system definition boundary changes affecting studio composition assumptions.
- Selector framework contract changes affecting cross-studio launch/return behavior.
