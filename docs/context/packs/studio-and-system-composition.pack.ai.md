# AI Companion: Studio and System Composition Pack

## Purpose

- Bounded context for studio and system composition tasks.
- Keep Studio Shell, System Studio, workflow handoff, and asset composition work aligned to canonical contracts.
- Prevent UI-first assumptions from replacing domain/application/system source-of-truth behavior.

## When To Use

- Designing or refactoring Studio Shell and System Studio interaction flows.
- Decomposing features spanning `src/ui/studio-shell`, `src/application/system-studio`, `src/application/workflow-studio`, and handoff seams.
- Updating selector launch/return behavior or studio return payload handling.
- Planning changes where system assets, workflow bindings, and studio UX must stay contract-aligned.

## When Not To Use

- Runtime host/bootstrap diagnostics (`runtime-and-host` primary).
- Context-routing/contract governance work (`context-system-foundations` primary).
- Narrow non-studio domain implementation tasks with no studio/system composition impact.
- Procedure-level runbook tasks.

## Invariants

- Preserve architecture direction: `domain -> application -> infrastructure/hosts/ui integration`.
- Keep system composition authoritative in domain/application seams; UI projects and orchestrates only.
- Use canonical studio handoff/return contracts; avoid ad hoc route/query flow semantics.
- Preserve workflow/system separation: workflows are reusable execution definitions; systems are reusable runnable configurations.
- Reuse shared selector/session/composition seams instead of feature-local duplicates.

## Authoritative Docs

- `docs/architecture/studio-handoff-contract.ai.md`
- `docs/architecture/image-workflow-system-definition-layer.ai.md`
- `docs/architecture/image-system-domain-foundation.ai.md`
- `docs/architecture/image-manipulation-studio-interaction-model.ai.md`
- `docs/architecture/asset-selector-framework.ai.md`
- `docs/architecture/shared-composition-taxonomy.ai.md`
- `docs/architecture/multi-surface-ui-composition-foundation.ai.md`
- `docs/ui/README.ai.md`

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

- Treating studio routes/components as authoritative workflow/system contracts.
- Merging workflow and system definitions into one mutable UI-only model.
- Implementing cross-studio launch/return through one-off query parsing outside canonical handoff seams.
- Rebuilding selector/session lifecycle logic in feature-local UI code.
- Applying runtime-host startup assumptions to studio/system composition without canonical contract evidence.

## Related Packs

- `repository-overview`: first-tier repository grounding.
- `architecture-core`: combine for broader boundary-sensitive design/refactor work.
- `runtime-and-host`: add when startup/runtime lifecycle behavior is in scope.
- `context-system-foundations`: add for routing/pack/governance asset changes.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.ai.md`
2. `docs/context/packs/architecture-core.pack.ai.md`
3. `docs/context/packs/studio-and-system-composition.pack.ai.md`
4. `docs/architecture/studio-handoff-contract.ai.md`
5. `docs/architecture/image-workflow-system-definition-layer.ai.md`
6. `docs/ui/README.ai.md`

## Change Triggers

- Studio handoff/return contract schema or lifecycle updates.
- Studio Shell/System Studio canonical doc or seam renames.
- Workflow/system boundary contract changes affecting studio composition.
- Selector framework contract updates that alter launch/return behavior.
