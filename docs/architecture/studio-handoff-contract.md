# Studio Handoff Contract (Epic 5.1 / 5.2)

## Purpose
Defines the canonical launch-and-return contract for cross-studio create/select flows, including Workflow Studio origin context and return/cancel/resume semantics.

## Canonical location
- Contract model + validation + query serialization:
  - `ui/routes/StudioHandoffContract.ts`
- Workflow-origin launch-context adapter:
  - `ui/studio-shell/workflow/WorkflowStudioLaunchContext.ts`
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

## Compatibility note
`InlineAssetCreation` still supports legacy selector query params (`selectorLaunch`, `selectorSessionId`, etc.).  
When those are absent, it now falls back to the canonical `studioHandoff` contract.

