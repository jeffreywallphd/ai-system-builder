# AI Companion: Studio Handoff Contract (Epic 5.1 / 5.2)

## What this is
Canonical launch/return contract for one studio launching another and returning control with created/selected assets.

## Where it lives
- Canonical contract + validation + query serializer/parser:
  - `src/ui/routes/StudioHandoffContract.ts`
- Shared return payload resolver:
  - `src/ui/routes/StudioReturnPayloadResolution.ts`
- Workflow-origin adapter (origin context generation):
  - `src/ui/studio-shell/workflow/WorkflowStudioLaunchContext.ts`
- Workflow return restoration adapter:
  - `src/ui/studio-shell/workflow/WorkflowStudioReturnRestorationService.ts`
- Integration seam that transports it in route params:
  - `src/ui/routes/InlineAssetCreation.ts`

## Required fields
- `launch.handoffId`
- `launch.launchedAt`
- `launch.launchSource`
- `launch.launchIntent`
- `origin.studioType`
- `origin.route.path`
- `target.selector.selectorSessionId`
- `target.selector.assetType`
- `returnContract.target.routePath`
- `resume.destinationRoutePath`

## Optional fields
- `origin.studioId`, `origin.route.search`, `origin.route.hash`
- `origin.workflowAuthoring.modeId`, `wizardPageId`, `draftReference`, `draftState`
- `target.selector.originatingField`, `usageContext`, `selectorTargetId`
- `returnContract.target.contextId`
- `resume.state`

## Workflow-origin behavior (Story 5.2)
Workflow selectors now build and pass handoff context that includes:
- origin route
- draft reference and draft-state snapshot
- selector target identity/context
- return destination

Primary call path:
- `AssetSelectorStudioLaunchService.launch(...)`
  - builds canonical handoff via `createWorkflowStudioOriginLaunchContext(...)`
  - forwards handoff through `InlineAssetCreationService.launch(...)`

## Return/cancel/resume semantics
- Return target is canonicalized in `returnContract.target.routePath`.
- Supported outcomes are explicit:
  - `created`
  - `cancelled`
  - `no-selection`
  - `abandoned`
- Resume destination is explicit:
  - `resume.destinationRoutePath`
- Legacy inline return/search semantics are preserved; contract support is additive and backward-compatible.

## Story 5.3 return payload resolution layer
- Return payload handling now flows through `StudioReturnPayloadResolver`:
  - parse + validate inline return payload shape
  - discriminate typed outcome (`created`/`cancelled`/`no-selection`/`abandoned`/`invalid`)
  - project selector target context (`selectorSessionId`, `originatingField`, `selectorTargetId`) from canonical handoff when present
- `AssetSelectorReturnHandoffService` now consumes that resolver so feature surfaces no longer implement hand-written query validation logic.

## Story 5.4 workflow session restoration and persistence
- Workflow Studio now restores handoff-origin authoring context from return payloads through `WorkflowStudioReturnRestorationService`:
  - restores valid origin mode
  - rehydrates origin draft-state snapshot
  - restores draft/session identity into shared draft sync context
- `WorkflowStudioModeStateStore` now persists mode + canonical shared draft state per studio id in local storage (`ai-loom.workflow-studio.mode-state.v1`), so in-progress triggers/inputs/steps/outputs survive handoff navigation and reload.

## Stories 5.5 / 5.6 dataset input selector handoff slice
- Workflow Wizard Inputs now provides a direct "create dataset" launch path in the dataset selector surface (`WorkflowStudioInputSectionEditor`) while keeping existing dataset-selection behavior.
- Dataset launches continue through `AssetSelectorStudioLaunchService` and canonical handoff context, with explicit input-target identity (`selectorTargetId=workflow-inputs:dataset`) for deterministic return application.
- Return payload handling remains centralized in `AssetSelectorReturnHandoffService` + `StudioReturnPayloadResolver`; selector consumers can now enforce optional target guards (`selectorTargetId`, `originatingField`, `usageContext`) before applying returned assets.
- On valid created returns, selector session state is updated and canonical workflow draft dataset inputs are synchronized through existing draft seams (`replaceDatasetInputSelections`), preserving in-progress wizard state.
- Shared inline return UI now exposes an explicit `no-selection` return action for selector-origin launches so Workflow authoring can resume without mutating selected datasets; `cancelled` behavior remains unchanged.

## Stories 5.7 / 5.8 agent step selector handoff slice
- Workflow Wizard Steps now uses the same handoff shape as dataset inputs for agent/assistant step authoring (`WorkflowStudioStepSectionEditor`):
  - selector flow supports existing agent/assistant selection for step slots,
  - create-new launches Agent Studio through `AssetSelectorStudioLaunchService`.
- Step-target metadata is now explicit and validated on return:
  - `selectorTargetId` is canonical per step target (`workflow-step:new` or `workflow-step:<stepId>`),
  - return handling validates `originatingField` and `usageContext` (`steps.agent-assistant` / `workflow-step`) before mutating selector state.
- Created-return handling remains centralized in `AssetSelectorReturnHandoffService` + `StudioReturnPayloadResolver`:
  - matching returns are routed to the intended step selector target,
  - `cancelled` and `no-selection` remain no-op for workflow draft mutation.
- Workflow session resume remains aligned with Story 5.4:
  - mode/draft restoration via `WorkflowStudioReturnRestorationService`,
  - in-progress draft persistence via `WorkflowStudioModeStateStore`.

## Stories 5.9 / 5.10 cancel/back/abandon + multi-session safety hardening
- The canonical return lifecycle now includes an explicit `abandoned` outcome in both handoff outcomes and inline return payload status parsing.
- Inline returns now carry `inlineHandoffId` correlation metadata, and resolver validation rejects payloads where inline handoff id conflicts with canonical `studioHandoff.launch.handoffId`.
- Selector sessions now track the active launch handoff id (`creatingNewContext.launchHandoffId`) and enforce correlation on return:
  - stale or mismatched handoff returns are consumed and ignored safely (no workflow draft mutation),
  - cancellation-like outcomes (`cancelled`, `no-selection`, `abandoned`) resume selector sessions without mutating selected assets,
  - created returns only apply when lifecycle + handoff correlation are valid for the active launch.
- Workflow origin restoration now guards against stale reentry:
  - if handoff draft reference conflicts with current workflow draft sync context, restoration is ignored (`draft-context-mismatch`) instead of overwriting active authoring state.
- Workflow dataset and step selectors pass launch handoff id into session launch context so concurrent/repeated launches from the same selector session remain distinguishable and collision-safe.

## Stories 5.11 / 5.12 handoff status UX + cross-studio regression coverage
- Workflow wizard now has one shared handoff status surface (`WorkflowStudioHandoffStatusBanner`) instead of separate local notices for lifecycle outcomes.
- Status is centralized in typed workflow mode state (`WorkflowStudioModeStateStore.handoffStatus`) and updated from existing typed seams:
  - `launching`: create-new handoff initiated.
  - `pending`: waiting for return.
  - `resumed`: workflow authoring restored from canonical handoff context.
  - `completed`: returned asset applied to intended selector target.
  - `cancelled`: `cancelled`/`no-selection`/`abandoned` outcomes (non-destructive).
  - `recovered`: stale/invalid return ignored safely.
- Dataset and agent selectors publish status updates using existing correlation metadata (`launchHandoffId`, selector target metadata, selector session id), preserving 5.9/5.10 multi-session safety behavior.
- Cross-studio regression coverage now includes explicit dataset + agent launch/return/apply/resume/cancel + stale-correlation scenarios in `src/ui/studio-shell/asset-selector/tests/AssetSelectorFramework.integration.test.ts`.

## Backward compatibility
- Legacy selector launch params still parse as before.
- If those params are absent, `InlineAssetCreationService.parseSelectorLaunchFromSearch(...)` now falls back to parsing `studioHandoff`.



## Stories 5.2.1 / 5.2.2 image vertical-slice contracts and normalized identity resolution
- Added a canonical image-slice handoff contract model in `src/domain/studio-handoff/ImageStudioHandoffContract.ts` that standardizes cross-studio Data Studio -> Workflow Studio -> System Studio payloads for:
  - asset references and versioned references,
  - dataset instance references,
  - workflow references and system bindings,
  - runtime input payloads and runtime output payloads,
  - event payload structures,
  - lineage/trace identifiers (`handoffId`, `traceId`),
  - persisted cross-studio relationship records.
- Added an application-layer resolver seam in `src/application/studio-handoff/ImageStudioReferenceResolver.ts` so image slice flows use one normalized identity-resolution path rather than studio-specific ad hoc resolution logic.
- Resolver outcomes are explicit and inspectable for broken/missing/ambiguous/incompatible reference states:
  - `missing`
  - `broken`
  - `ambiguous`
  - `incompatible`
- Added focused contract/resolution coverage:
  - `src/domain/studio-handoff/tests/ImageStudioHandoffContract.test.ts`
  - `src/application/studio-handoff/tests/ImageStudioReferenceResolver.test.ts`

## Stories 5.2.3 / 5.2.4 image input/output handoff integration
- Workflow execution context assembly now accepts canonical image handoff payloads in workflow metadata (`metadata.imageStudioHandoff`) and validates shape through `createImageCrossStudioHandoffContract` before resolving inputs.
- Handoff runtime input context is projected into the existing reusable input-binding resolver context (`selectedImage`, `datasetInstances`) so selected-record and dataset-collection bindings resolve through shared contracts instead of studio-local mapping.
- Assembly now emits compact runtime handoff trace metadata (`imageStudioHandoffRuntime`) that preserves `handoffId`, `traceId`, workflow binding id, and source studio identity for downstream runtime/output seams.
- Runtime output persistence now propagates handoff trace metadata into output-binding lineage (`outputRelationship.metadata`) and returns a bounded handoff persistence summary (`handoffId`, `traceId`, persisted target instances/record ids).
- This completes the Data Studio -> Workflow Studio -> system-owned dataset handoff path for the image slice while staying on the same 5.2.1/5.2.2 contract and identity-resolution model.
