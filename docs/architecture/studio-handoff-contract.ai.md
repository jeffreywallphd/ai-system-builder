# AI Companion: Studio Handoff Contract (Epic 5.1 / 5.2)

## What this is
Canonical launch/return contract for one studio launching another and returning control with created/selected assets.

## Where it lives
- Canonical contract + validation + query serializer/parser:
  - `ui/routes/StudioHandoffContract.ts`
- Shared return payload resolver:
  - `ui/routes/StudioReturnPayloadResolution.ts`
- Workflow-origin adapter (origin context generation):
  - `ui/studio-shell/workflow/WorkflowStudioLaunchContext.ts`
- Workflow return restoration adapter:
  - `ui/studio-shell/workflow/WorkflowStudioReturnRestorationService.ts`
- Integration seam that transports it in route params:
  - `ui/routes/InlineAssetCreation.ts`

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
- Resume destination is explicit:
  - `resume.destinationRoutePath`
- Legacy inline return/search semantics are preserved; contract support is additive and backward-compatible.

## Story 5.3 return payload resolution layer
- Return payload handling now flows through `StudioReturnPayloadResolver`:
  - parse + validate inline return payload shape
  - discriminate typed outcome (`created`/`cancelled`/`no-selection`/`invalid`)
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

## Backward compatibility
- Legacy selector launch params still parse as before.
- If those params are absent, `InlineAssetCreationService.parseSelectorLaunchFromSearch(...)` now falls back to parsing `studioHandoff`.

