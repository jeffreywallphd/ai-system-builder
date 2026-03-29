# Studio Handoff Contract (Epic 5.1 / 5.2)

## Purpose
Defines the canonical launch-and-return contract for cross-studio create/select flows, including Workflow Studio origin context and return/cancel/resume semantics.

## Canonical location
- Contract model + validation + query serialization:
  - `ui/routes/StudioHandoffContract.ts`
- Shared return payload resolution:
  - `ui/routes/StudioReturnPayloadResolution.ts`
- Workflow-origin launch-context adapter:
  - `ui/studio-shell/workflow/WorkflowStudioLaunchContext.ts`
- Workflow return restoration adapter:
  - `ui/studio-shell/workflow/WorkflowStudioReturnRestorationService.ts`
- Route-level launch/parse integration:
  - `ui/routes/InlineAssetCreation.ts`

## Contract shape
Top-level fields:
- `launch`
- `origin`
- `target`
- `returnContract`
- `resume`

### Required fields
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

### Optional fields
- `origin.studioId`
- `origin.route.search`
- `origin.route.hash`
- `origin.workflowAuthoring.modeId`
- `origin.workflowAuthoring.wizardPageId`
- `origin.workflowAuthoring.draftReference`
- `origin.workflowAuthoring.draftState`
- `target.selector.originatingField`
- `target.selector.usageContext`
- `target.selector.selectorTargetId`
- `returnContract.target.contextId`
- `resume.state`

## Workflow Studio origin usage (Story 5.2)
Workflow selectors (inputs/steps) now generate origin launch context through `WorkflowStudioLaunchContext` and pass it in launch requests.

Included Workflow-origin context:
- originating route (`path`, `search`, `hash`)
- workflow draft reference (`studioId`, `draftId/sessionId/assetId/versionId` when available)
- workflow draft state snapshot (serialized draft JSON)
- selector target context (`selectorSessionId`, `assetType`, `originatingField`, optional target id)
- return destination route

## Return / cancel / resume semantics
- Return destination is canonicalized in `returnContract.target.routePath`.
- Expected outcomes are explicit in `returnContract.outcomes`:
  - `created`
  - `cancelled`
  - `no-selection`
  - `abandoned`
- Resume destination is explicit in `resume.destinationRoutePath`.
- Existing inline return payload (`inlineReturn` query semantics) remains backward-compatible and unchanged for active callers.

### Story 5.3 return payload resolution
- Return payload parsing/validation/discrimination now goes through `StudioReturnPayloadResolver` rather than ad hoc query parsing in feature pages.
- Resolution returns typed outcomes (`created`, `cancelled`, `no-selection`, `abandoned`, `invalid`) plus selector-target metadata (`selectorSessionId`, `originatingField`, `selectorTargetId`) when available from canonical handoff context.
- `AssetSelectorReturnHandoffService` now consumes that typed resolver and applies cancel/no-selection outcomes without mutating selected assets.

### Story 5.4 workflow return restoration + persistence
- Workflow Studio now restores launch-origin context from canonical handoff return payloads via `WorkflowStudioReturnRestorationService`:
  - restores mode (`origin.workflowAuthoring.modeId`) when valid
  - restores workflow draft snapshot (`origin.workflowAuthoring.draftState`) when present
  - restores draft/session identity (`origin.workflowAuthoring.draftReference`) into mode-store sync context
- Workflow mode/draft state now persists across refresh/reload through `WorkflowStudioModeStateStore` local-storage snapshots keyed per studio id (`ai-loom.workflow-studio.mode-state.v1`), preserving in-progress triggers/inputs/steps/outputs through cross-studio launch/return flows.

### Stories 5.5 / 5.6 dataset selector launch + return slice
- Workflow Wizard Inputs now exposes a direct dataset creation launch affordance from the dataset input selector surface (`WorkflowStudioInputSectionEditor`), in addition to existing dataset selection.
- Dataset launch continues to use the canonical handoff/origin contract through `AssetSelectorStudioLaunchService`, now with explicit selector target identity for inputs (`selectorTargetId=workflow-inputs:dataset`).
- Dataset return application remains centralized in `AssetSelectorReturnHandoffService` + `StudioReturnPayloadResolver` and now supports optional selector-target guard checks (`selectorTargetId`, `originatingField`, `usageContext`) before mutating selector session state.
- Successful created returns are applied to the active dataset selector session and persisted back into canonical workflow draft inputs via existing draft update seams (`replaceDatasetInputSelections`), preserving in-progress wizard authoring state.
- No-op flows are explicit:
  - `cancelled` keeps dataset selections unchanged and resumes selector session.
  - `no-selection` is now surfaced in shared inline return UI (`StudioShellPage`) for selector-launched studios and resumes Workflow authoring without mutating attached dataset inputs.

### Stories 5.7 / 5.8 agent step selector launch + return slice
- Workflow Wizard Steps now mirrors the dataset handoff pattern for agent/assistant steps (`WorkflowStudioStepSectionEditor`):
  - users can select existing agents/assistants for step slots,
  - selector-driven "create agent/assistant" launches Agent Studio through `AssetSelectorStudioLaunchService`.
- Agent launch handoff now carries step-target metadata for deterministic return application:
  - `target.selector.selectorTargetId` uses canonical step target ids (`workflow-step:new` or `workflow-step:<stepId>`),
  - `target.selector.originatingField` and `usageContext` are validated on return (`steps.agent-assistant` / `workflow-step`).
- Return payload handling remains centralized in `AssetSelectorReturnHandoffService` + `StudioReturnPayloadResolver`:
  - only matching selector target metadata is applied to the active step selector session,
  - created returns are applied to the intended step target,
  - `cancelled` and `no-selection` outcomes resume the selector session without mutating workflow draft state.
- Workflow authoring resume behavior remains shared with Story 5.4:
  - mode/draft snapshot restoration continues through `WorkflowStudioReturnRestorationService`,
  - in-progress workflow draft state remains preserved via `WorkflowStudioModeStateStore` persistence.

### Stories 5.9 / 5.10 resilience hardening (cancel/back/abandon + multi-session safety)
- The handoff lifecycle now explicitly models `abandoned` alongside `created`, `cancelled`, and `no-selection`.
- Inline return payloads now include optional handoff correlation (`inlineHandoffId`), and `StudioReturnPayloadResolver` rejects returns where inline correlation disagrees with canonical handoff id (`studioHandoff.launch.handoffId`).
- Selector return application is now launch-correlated:
  - selector sessions persist active launch handoff id (`creatingNewContext.launchHandoffId`),
  - stale/mismatched returns are consumed safely and ignored for draft mutation,
  - created returns only apply when lifecycle and handoff correlation match the active in-flight launch.
- Cancellation-style outcomes are non-destructive by contract:
  - `cancelled`, `no-selection`, and `abandoned` resume selector sessions and preserve prior selected assets/draft state.
- Workflow return restoration now guards against stale reentry:
  - restoration is ignored when handoff draft reference does not match current draft/session sync context (`draft-context-mismatch`), preventing wrong-draft overwrite during repeated launches/reentries.

## Compatibility note
`InlineAssetCreation` still supports legacy selector query params (`selectorLaunch`, `selectorSessionId`, etc.).  
When those are absent, it now falls back to the canonical `studioHandoff` contract.

