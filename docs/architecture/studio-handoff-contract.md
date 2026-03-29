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
- Resume destination is explicit in `resume.destinationRoutePath`.
- Existing inline return payload (`inlineReturn` query semantics) remains backward-compatible and unchanged for active callers.

### Story 5.3 return payload resolution
- Return payload parsing/validation/discrimination now goes through `StudioReturnPayloadResolver` rather than ad hoc query parsing in feature pages.
- Resolution returns typed outcomes (`created`, `cancelled`, `no-selection`, `invalid`) plus selector-target metadata (`selectorSessionId`, `originatingField`, `selectorTargetId`) when available from canonical handoff context.
- `AssetSelectorReturnHandoffService` now consumes that typed resolver and applies cancel/no-selection outcomes without mutating selected assets.

### Story 5.4 workflow return restoration + persistence
- Workflow Studio now restores launch-origin context from canonical handoff return payloads via `WorkflowStudioReturnRestorationService`:
  - restores mode (`origin.workflowAuthoring.modeId`) when valid
  - restores workflow draft snapshot (`origin.workflowAuthoring.draftState`) when present
  - restores draft/session identity (`origin.workflowAuthoring.draftReference`) into mode-store sync context
- Workflow mode/draft state now persists across refresh/reload through `WorkflowStudioModeStateStore` local-storage snapshots keyed per studio id (`ai-loom.workflow-studio.mode-state.v1`), preserving in-progress triggers/inputs/steps/outputs through cross-studio launch/return flows.

## Compatibility note
`InlineAssetCreation` still supports legacy selector query params (`selectorLaunch`, `selectorSessionId`, etc.).  
When those are absent, it now falls back to the canonical `studioHandoff` contract.

