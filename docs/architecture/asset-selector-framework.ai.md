# AI Companion: Asset Selector Framework (Epic 4 Foundation)

## Why this exists
- Studios need one selector contract for reusable asset selection flows.
- Workflow input/step selectors must enforce taxonomy/capability truth consistently.
- Selector behavior must be inner-layer and UI-agnostic.

## Where to look
- Domain selector contract: `domain/studio-shell/AssetSelectorContract.ts`
- Capability matrix + application enforcement: `application/studio-entry/AssetSelectorCapabilityRegistry.ts`
- Contract tests: `domain/studio-shell/tests/AssetSelectorContract.test.ts`
- Capability tests: `application/studio-entry/tests/AssetSelectorCapabilityRegistry.test.ts`

## Story 4.1 implemented contract
- `AssetSelectorRequest`, `AssetSelectorContext`, `AssetSelectorResult`
- Selection mode: `single-select` / `multi-select`
- Selection type: `existing-asset` / `create-new-asset`
- Explicit cancel result (`kind=cancelled`)
- Minimal canonical return payload (`assetId`, `assetType`, optional `versionId`, optional `displayName`, optional taxonomy)

## Story 4.1 validation behavior
- Invalid asset type rejection
- Selection mode/type validation
- Launch context required-field validation
- Selection constraint validation (`required`, `minSelections`, `maxSelections`)
- Single-select bound enforcement
- Result payload validation:
  - selected result must include assets
  - cancel result cannot include selections
  - result asset type/taxonomy must align with request asset type
  - selection counts must respect request constraints

## Story 4.2 capability matrix
Default centralized matrix:
- `workflow-input` -> `dataset`
- `workflow-step` -> `agent`
- `workflow-model` -> `model` (future)
- `workflow-tool` -> `tool` (future)
- `workflow-system` -> `system` (future)

The matrix is centralized in `AssetSelectorCapabilityRegistry` (no scattered `if` checks).

## Story 4.2 enforcement path
- Domain-level request/result validation in `AssetSelectorContract`
- Application-level matrix validation in `AssetSelectorApplicationValidationService`
- Defensive fail-fast via `assertValidRequest` and `assertValidResult`

## Story 4.3 implemented state/session foundation
- Application session store: `application/studio-entry/AssetSelectorSessionStore.ts`
- Session model now includes:
  - request/context
  - selected assets
  - pending selections
  - lifecycle state
  - validation errors
  - `creatingNewContext` (origin context, requested creation asset type, return target session/route)
- Lifecycle states implemented:
  - `idle`
  - `active`
  - `creating-new`
  - `returning`
  - `cancelled`
  - `completed`
- Return handling:
  - accepts canonical `AssetSelectorResult`
  - validates through Story 4.1 + 4.2 seams
  - merges selected/new assets into session state
- Navigation/session continuity:
  - sessions are keyed and isolated by `sessionKey`
  - snapshot create/restore supports route-transition preservation workflows
- Error handling includes:
  - invalid return payloads
  - asset-type mismatches
  - snapshot restoration failures

## Story 4.4 implemented reusable shell
- Shell UI: `ui/components/studio-shell/asset-selector/AssetSelectorShell.tsx`
- Data provider contract: `ui/studio-shell/asset-selector/AssetSelectorDataProvider.ts`
- Registry-backed adapter: `ui/studio-shell/asset-selector/RegistryAssetSelectorDataProvider.ts`
- Session accessor seam: `ui/studio-shell/asset-selector/AssetSelectorSessionRegistry.ts`

Shell behavior:
- search input
- loading/empty/error/populated result states
- selected indicators and summary
- single/multi-select support
- confirm/cancel actions
- create-new action entry point
- baseline keyboard controls (arrow navigation, enter/space select, escape cancel, ctrl/cmd+enter confirm)

Separation reminder:
- session/lifecycle/capability rules stay in application layer
- shell stays presentation-only and asset-type-agnostic
- fetching goes through provider adapter seam (no hardcoded dataset/agent logic in shell)

## Story 4.5 implemented dataset selector
- Dataset adapter: `ui/studio-shell/asset-selector/DatasetAssetSelectorAdapter.ts`
- Workflow integration: `ui/components/studio-shell/workflow/WorkflowStudioInputSectionEditor.tsx`

Implemented behavior:
- Canonical dataset selector request creation for `usageContext=workflow-input`.
- Registry query/mapping constrained to dataset taxonomy (`atomic/dataset/none`).
- Shared shell + shared session store multi-select handling for workflow inputs.
- Selection propagation into canonical workflow draft dataset inputs through existing workflow draft helpers.
- Empty/error handling plus filtering of unavailable/deleted rows.
- Create-new action launches Dataset Studio through shared selector launch service and keeps selector session state in `creating-new` until return/cancel.

## Story 4.6 implemented agent/assistant selector
- Agent adapter: `ui/studio-shell/asset-selector/AgentAssistantAssetSelectorAdapter.ts`
- Workflow integration: `ui/components/studio-shell/workflow/WorkflowStudioStepSectionEditor.tsx`
- Step payload mapping seam: `ui/studio-shell/workflow/WorkflowWizardSteps.ts`

Implemented behavior:
- Canonical agent selector request creation for `usageContext=workflow-step`.
- Single-select default for step insertion with multi-select request flexibility retained.
- Registry query/mapping constrained to agent taxonomy (`composite/agent/autonomous`).
- Confirmed selections map to step-compatible payload semantics (asset reference + config placeholder) before draft updates.
- Ordered step insertion/editing compatibility remains intact.
- Empty/error handling plus filtering of unavailable/deleted or invalid-role rows.
- Create-new action launches Agent Studio through shared selector launch service and keeps selector session state in `creating-new` until return/cancel.

## Story 4.7 implemented inline studio launch for missing assets
- Central launcher: `ui/studio-shell/asset-selector/AssetSelectorStudioLaunchService.ts`
- Shared route handoff seam: `ui/routes/InlineAssetCreation.ts`
- Selector UI wiring:
  - `WorkflowStudioInputSectionEditor.tsx` (dataset selector -> Dataset Studio)
  - `WorkflowStudioStepSectionEditor.tsx` (agent selector -> Agent Studio)

Launch contract now carries:
- selector session key (`selectorSessionId` / `returnContextId`)
- asset type being created (`selectorAssetType`)
- return route context (`returnTo` + selector route metadata)

Navigation/lifecycle behavior:
- selector transitions `active -> creating-new` before navigation
- selected/pending selector state remains preserved in the session store during route transition
- cancel/exit-from-creation uses safe return semantics (`resumeAfterCreationCancellation`) so selector state is restored to `active` without corruption

## Story 4.8 implemented return-to-selector handoff contract
- Return handler seam: `ui/studio-shell/asset-selector/AssetSelectorReturnHandoffService.ts`
- Return payload contract (query-backed) now includes:
  - `assetId`
  - `assetType`
  - optional `versionId`
  - optional `displayName`
  - selector return context id (`returnContextId`) for multi-session targeting

Studio integration:
- Dataset Studio (shared shell path) and Agent Studio detect selector launch context via `InlineAssetCreationService.parseSelectorLaunchFromSearch`.
- Successful creation emits created-return payload and routes back to selector return target.
- Cancel path emits cancelled-return payload and routes back safely.

Selector rehydration + validation behavior:
- On return: selector session transitions through `returning` and resumes to `active` after successful return handling.
- Returned assets flow through existing Story 4.1/4.2 validation (`AssetSelectorSessionStore.handleReturnPayload` + capability matrix checks).
- Malformed payloads, stale sessions, and mismatched asset types are safely rejected with session validation issues.
- Returned assets are merged into selector options and selected assets for immediate user confirmation/modification.
- Multiple selector sessions are isolated by `sessionKey`/`returnContextId` targeting.

## Story 4.9 implemented workflow wizard inputs integration
- Workflow surface: `ui/components/studio-shell/workflow/WorkflowStudioInputSectionEditor.tsx`
- Dataset input attachments are now selector-first:
  - selected datasets are shown as explicit rows (title + asset id + optional version),
  - remove actions mutate canonical workflow draft inputs directly,
  - add/modify opens shared selector shell instead of ad hoc input picker behavior.
- Selector session state now synchronizes with canonical draft dataset inputs via shared session-store selection replacement APIs, preventing selector/draft drift across reopen and route transitions.
- Confirmed selector selections persist through `replaceDatasetInputSelections` into canonical `WorkflowDraft.inputs`.
- Inline create-new dataset handoff returns into the active selector/session and preserves wizard draft state.
- Capability enforcement remains shared-validator/matrix-based (`workflow-input` -> `dataset`), not UI-only filtering.

## Story 4.10 implemented workflow wizard steps integration
- Workflow surface: `ui/components/studio-shell/workflow/WorkflowStudioStepSectionEditor.tsx`
- Agent/assistant step attachments are now selector-first:
  - add-step (agent/assistant) opens shared selector and inserts step on confirm,
  - existing asset-backed steps use selector-driven replace/edit actions,
  - ad hoc per-step asset dropdown selection path was removed.
- Add-vs-replace selector intent survives inline create-new route transitions via selector-target query metadata, so returned assets apply to the correct step operation.
- Confirmed selections still map through canonical step helper seams (`setWorkflowStepAgentAssetSelection`) preserving step payload compatibility (`assetRef` + placeholder config).
- Step ordering/reorder/remove behavior remains canonical-step-id based and isolated from selector session state.
- Capability enforcement remains shared-validator/matrix-based (`workflow-step` -> `agent`), not UI-only filtering.

## Story 4.11 hardening: validation, constraints, and error handling
Validation/constraint logic is now stricter at source-of-truth seams:
- Domain contract (`domain/studio-shell/AssetSelectorContract.ts`):
  - canonical return identity enforcement (`assetId`/`versionId` require `asset:` shape),
  - duplicate selected-asset entries are rejected,
  - existing type/taxonomy/min-max checks remain canonical.
- Application selector session (`application/studio-entry/AssetSelectorSessionStore.ts`):
  - centralized selection-set validation for toggle/set/replace paths,
  - over-selection is blocked before confirm,
  - required/min constraints are enforced at confirm,
  - snapshot restore now validates session key, lifecycle state, creating-new context alignment, and restored selections.
- Return handoff (`ui/studio-shell/asset-selector/AssetSelectorReturnHandoffService.ts`):
  - stale created-return payloads are rejected when lifecycle is not creation-return aligned,
  - malformed return payloads still route to safe session validation issues.

Error strategy remains bounded:
- selector/session errors are user-facing but non-internal,
- invalid states fail safe and do not crash wizard/selector surfaces,
- invalid selector states are rejected before workflow draft mutation.

## Story 4.12 hardening: persistence and rehydration support
Persistence/rehydration seams are now more defensive and consistent:
- Dataset draft sync (`ui/studio-shell/workflow/WorkflowWizardDatasetInputs.ts`):
  - replacement equality includes version/title, not only asset id,
  - canonical dataset id/version guards prevent malformed references,
  - dataset replacement preserves non-dataset input isolation.
- Step draft sync (`ui/studio-shell/workflow/WorkflowWizardSteps.ts`):
  - canonical agent/assistant id/version guards prevent malformed step references.
- Wizard rehydration UX:
  - inputs/steps now surface unavailable/deleted attached-asset warnings when selected references are absent from selector catalog reads.
- Rehydration performance:
  - dataset/agent selector adapters now use bounded short-lived in-memory query caching to reduce redundant refetching during route transitions/reopen flows.

Selector session vs workflow draft model:
- canonical persisted truth is workflow draft (`inputs` + `steps.assetRef`),
- selector sessions remain ephemeral interaction state (pending/lifecycle/validation),
- rehydration synchronizes selector interaction state from canonical draft without persisting UI-only session artifacts.

## Story 4.13: studio-shell authoring promotion + configurable toolbar contract
- Studio Shell registration contracts now support an optional shell toolbar configuration (`ui/studio-shell/StudioShellExtensions.ts`) with typed toolbar actions:
  - `refresh-snapshot`
  - `save-draft`
  - `run-validation`
  - `set-workflow-mode`
- Toolbar configuration is registration-owned (not user-authored) and validated/normalized at registration boundaries (required ids/labels, duplicate detection, workflow-mode validity checks).
- `StudioShellPage` now renders draft authoring as a primary top-level section outside and above the two-column shell grid, preserving existing session/metadata/dependencies/lifecycle/validation cards and extension slots.
- Workflow Studio now demonstrates shell-specific toolbar configuration through registration metadata (`ui/studio-shell/registrations/WorkflowStudioRegistration.ts`) with wizard/canvas mode actions and draft/validation controls.
- Toolbar actions interact through existing shell orchestration seams (shared mode state store + existing draft/validation operations) without bypassing selector/session infrastructure or duplicating validation logic.

## Future asset-type integration pattern
For new selector types, keep shared shell/session unchanged and add:
1. A typed adapter in `ui/studio-shell/asset-selector/` (request builder + source mapping).
2. Capability matrix support in `AssetSelectorCapabilityRegistry`.
3. Feature-surface integration via shared store + shared shell.
4. Asset-type logic only in adapters/feature seams, not in shared shell/state infrastructure.

## Extensibility
- New usage contexts can be added by registry registration.
- New allowed asset-type mappings per context are configuration-driven.
- Existing validator code does not require refactor for new context/type combinations.

## Scope boundaries
- Shared selector shell/session/capability infrastructure remains reusable and UI-agnostic.
- Workflow wizard wiring for inputs + steps is now implemented through those shared seams.
- No parallel selector architecture or selector-bypass paths should be introduced for future workflow sections.
