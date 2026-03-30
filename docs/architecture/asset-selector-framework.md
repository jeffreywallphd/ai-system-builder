# Asset Selector Framework (Epic 4 Foundation)

## Purpose
The Asset Selector Framework defines a reusable, UI-independent contract for selecting assets and returning results across studios, with centralized capability rules for where each asset type is valid.

## Layer placement
- Domain contract: `domain/studio-shell/AssetSelectorContract.ts`
- Application capability matrix and enforcement: `application/studio-entry/AssetSelectorCapabilityRegistry.ts`

This keeps interaction semantics in inner layers and avoids UI-coupled selector logic.

## Story 4.1: Selector contract
The domain contract defines:
- `AssetSelectorRequest`
- `AssetSelectorContext`
- `AssetSelectorResult`
- Selection modes: `single-select`, `multi-select`
- Selection types: `existing-asset`, `create-new-asset`

Request semantics include:
- Requested `assetType` (taxonomy semantic role)
- Selection constraints (`required`, `minSelections`, `maxSelections`)
- Launch context (`originatingStudio`, `originatingField`, optional source/usage metadata)

Result semantics are explicit:
- Existing selection: `kind=selected`, `selectionType=existing-asset`, selected asset references
- Create-new selection: `kind=selected`, `selectionType=create-new-asset`, selected asset references
- Cancel: `kind=cancelled`, optional reason, no selected assets

Return payload shape is minimal and canonical:
- `assetId` (required)
- `assetType` (required)
- optional `versionId`
- optional `displayName`
- optional taxonomy descriptor

Validation in the domain contract enforces:
- invalid asset types
- invalid modes/selection types
- malformed launch context
- malformed return payloads
- selection min/max violations
- return asset type/taxonomy mismatch

## Story 4.2: Capability matrix
Capability rules are centralized in `AssetSelectorCapabilityRegistry` by `usageContext`.

Initial/default matrix:
- `workflow-input` -> `dataset`
- `workflow-step` -> `agent`
- `workflow-model` -> `model` (future extensibility)
- `workflow-tool` -> `tool` (future extensibility)
- `workflow-system` -> `system` (future extensibility)

Enforcement path:
1. Domain request/result normalization and validation (`AssetSelectorContract`).
2. Application matrix validation (`AssetSelectorApplicationValidationService`).
3. Defensive fail-fast methods (`assertValidRequest`, `assertValidResult`) for authoritative call sites.

This prevents invalid combinations (for example dataset selection in workflow step context) without scattered conditionals.

## Story 4.3: Shared selector state and session infrastructure
Session/state infrastructure is now implemented in:
- `application/studio-entry/AssetSelectorSessionStore.ts`

Responsibilities:
- Canonical session state model per selector session key:
  - active request/context
  - selected assets
  - pending selections
  - lifecycle state
  - validation/error state
  - creation launch context (`creatingNewContext`: origin context, requested asset type, return target session/route)
- Lifecycle support:
  - `idle`
  - `active`
  - `creating-new`
  - `returning`
  - `cancelled`
  - `completed`
- Session-scoped state isolation:
  - multiple selector sessions can co-exist without collisions (`sessionKey` map)
- Route-transition resilience:
  - in-memory session registry can be reused across route changes
  - snapshot create/restore hooks support explicit navigation preservation workflows
- Return payload integration:
  - accepts canonical `AssetSelectorResult`
  - validates through domain + capability matrix enforcement
  - merges valid returned assets into selected/pending session state
- Error handling:
  - invalid return payloads
  - mismatched asset types
  - snapshot restore failures

Boundary note:
- Session business rules remain in application layer.
- UI consumes session state through thin adapters and does not own lifecycle/capability validation logic.

## Story 4.4: Reusable selector shell UI
Shared selector shell is now implemented in:
- Presentation shell: `ui/components/studio-shell/asset-selector/AssetSelectorShell.tsx`
- Data-provider seam: `ui/studio-shell/asset-selector/AssetSelectorDataProvider.ts`
- Registry adapter: `ui/studio-shell/asset-selector/RegistryAssetSelectorDataProvider.ts`
- Session bridge accessor: `ui/studio-shell/asset-selector/AssetSelectorSessionRegistry.ts`

Shell responsibilities:
- Search input
- Loading/empty/error states
- Result list with selected indicators
- Selection summary
- Confirm/cancel actions
- Create-new entry point
- Keyboard accessibility baseline:
  - up/down focus movement
  - enter/space selection
  - escape cancel
  - ctrl/cmd+enter confirm

Separation model:
- Application session store owns lifecycle + selection truth.
- Data provider adapter owns asset fetching shape.
- Shell component is presentation-only and asset-type-agnostic.

Current integration slice:
- Workflow Wizard dataset input section now renders through the shared selector shell and shared session store.
- Dataset/agent specific selector behavior remains out of scope; this slice only provides reusable shell + state/session foundation.

## Story 4.5: Dataset asset selector integration
Dataset-specific selector integration is now implemented through:
- Adapter/data provider: `ui/studio-shell/asset-selector/DatasetAssetSelectorAdapter.ts`
- Workflow wizard inputs integration: `ui/components/studio-shell/workflow/WorkflowStudioInputSectionEditor.tsx`

Responsibilities:
- Builds canonical dataset selector requests for workflow input usage (`usageContext=workflow-input`).
- Loads dataset assets from registry sources with dataset taxonomy filters (`atomic/dataset/none`).
- Maps registry entities into shell result items with canonical asset references.
- Enforces multi-select workflow input semantics via shared session state.
- Persists and propagates confirmed selections back into canonical workflow draft inputs through existing workflow draft utilities.
- Handles empty/error states and excludes unavailable/deleted rows from selectable results.

Create-new behavior:
- Create-new launches Dataset Studio via shared selector launch contract and preserves selector session state during navigation.

## Story 4.6: Agent/assistant asset selector integration
Agent/assistant-specific selector integration is now implemented through:
- Adapter/data provider: `ui/studio-shell/asset-selector/AgentAssistantAssetSelectorAdapter.ts`
- Workflow wizard steps integration: `ui/components/studio-shell/workflow/WorkflowStudioStepSectionEditor.tsx`
- Step payload seam: `ui/studio-shell/workflow/WorkflowWizardSteps.ts`

Responsibilities:
- Builds canonical agent selector requests for workflow step usage (`usageContext=workflow-step`).
- Defaults to single-select for step insertion, with multi-select available through request options.
- Loads agent/assistant assets with taxonomy filters (`composite/agent/autonomous`).
- Maps confirmed selector choices into step-compatible payload semantics (asset reference + config placeholder) before applying to workflow steps.
- Preserves compatibility with ordered step insertion and existing step editing/reordering behavior.
- Handles empty/error states and excludes unavailable/deleted or invalid-role rows.

Create-new behavior:
- Create-new launches Agent Studio via shared selector launch contract and preserves selector session state during navigation.

## Story 4.7: Inline studio launch for missing assets
Implemented seams:
- `ui/studio-shell/asset-selector/AssetSelectorStudioLaunchService.ts`
- `ui/routes/InlineAssetCreation.ts`
- Workflow selector integrations:
  - `ui/components/studio-shell/workflow/WorkflowStudioInputSectionEditor.tsx`
  - `ui/components/studio-shell/workflow/WorkflowStudioStepSectionEditor.tsx`

Launch contract now carries:
- selector session id (`selectorSessionId` / `returnContextId`)
- asset type being created (`selectorAssetType`)
- return route/context (`returnTo` + selector route metadata)

Lifecycle/navigation semantics:
- selector transitions `active -> creating-new` before route handoff
- selector selected/pending state remains in shared session store during navigation
- cancelled creation returns safely with selector session restored to `active` and no selection corruption

## Story 4.8: Return-to-selector handoff contract
Implemented seams:
- `ui/studio-shell/asset-selector/AssetSelectorReturnHandoffService.ts`
- Return contract extensions in `ui/routes/InlineAssetCreation.ts`

Return payload contract now includes:
- `assetId`
- `assetType`
- optional `versionId`
- optional `displayName`
- selector-targeting context (`returnContextId`) for multi-session routing

Studio integration:
- Dataset Studio and Agent Studio detect selector-launch context from route params.
- Successful creation emits created-return payload and navigates back to the originating selector route.
- Cancel emits cancelled-return payload and routes back safely.

Selector return handling:
- session transitions include `creating-new -> returning -> active` for creation handoffs
- returned assets are validated through existing Story 4.1 + 4.2 seams (contract + capability matrix)
- invalid payloads, stale sessions, and mismatched asset types are rejected safely
- valid returned assets are merged into selector options and selected assets for immediate confirm/modify flows
- multiple concurrent selectors remain isolated by session key/return-context targeting

## Story 4.9: Workflow wizard inputs selector integration
Workflow Wizard Inputs now use selector-first dataset attachment flow in:
- `ui/components/studio-shell/workflow/WorkflowStudioInputSectionEditor.tsx`

Implemented behavior:
- Dataset inputs are rendered as canonical selected dataset rows (title + asset id + optional version) with explicit remove actions.
- Dataset add/modify uses the shared selector shell (open/close + confirm/cancel) instead of ad hoc input-picking logic.
- Selector session state is synchronized with canonical workflow draft dataset inputs through shared session-store APIs so route transitions/reopen flows do not drift.
- Confirmed selector selections persist back into canonical workflow draft inputs via `replaceDatasetInputSelections`.
- Create-new dataset launch/return keeps wizard draft state intact and reopens selector with returned assets available for immediate confirm.
- Capability enforcement remains matrix-driven (`workflow-input` -> `dataset`) through shared request/result validation, not UI-only checks.

## Story 4.10: Workflow wizard steps selector integration
Workflow Wizard Steps now use selector-first agent/assistant attachment flow in:
- `ui/components/studio-shell/workflow/WorkflowStudioStepSectionEditor.tsx`

Implemented behavior:
- Adding an agent/assistant step routes through the shared agent selector shell (single-select) before step insertion.
- Existing agent/assistant-backed steps support selector-driven replace/edit actions; per-step ad hoc dropdown asset-picking was retired.
- Selector targeting context for add vs replace is preserved across inline create-new route transitions via route-state query metadata.
- Confirmed selections map into canonical step payload semantics (`assetRef` + placeholder config) through existing `WorkflowWizardSteps` helpers.
- Step ordering/reorder/remove flows continue to operate on canonical step ids and remain isolated from selector session state.
- Capability enforcement remains matrix-driven (`workflow-step` -> `agent`) through shared request/result validation, not UI-only checks.

## Story 4.11: Validation, constraints, and error handling hardening
Validation and guardrails are now enforced at authoritative seams:
- Domain contract hardening (`domain/studio-shell/AssetSelectorContract.ts`):
  - canonical selector return identity enforcement (`assetId`/`versionId` must use `asset:` identity when provided),
  - duplicate selection rejection,
  - existing asset-type, taxonomy, and min/max checks remain canonical.
- Application session hardening (`application/studio-entry/AssetSelectorSessionStore.ts`):
  - centralized selection-set validation for pending/replace flows (asset type, canonical id/version, duplicate checks),
  - proactive over-selection blocking before confirm,
  - confirm-time minimum/required selection enforcement,
  - stricter snapshot/session restoration checks (session key, lifecycle validity, creating-new context consistency, selection validity).
- Return handoff hardening (`ui/studio-shell/asset-selector/AssetSelectorReturnHandoffService.ts`):
  - stale created-return payloads are rejected unless selector session is in creation-return lifecycle,
  - malformed return payloads fail safely through session-level validation errors.

Error handling strategy:
- Fail-safe validation errors are projected through selector session state.
- UI surfaces bounded, meaningful selector errors without internal exception details.
- Invalid return/session states do not crash workflow wizard or selector shell.

## Story 4.12: Persistence and draft rehydration hardening
Persistence and rehydration consistency is now tightened across selector and draft seams:
- Dataset draft persistence consistency (`ui/studio-shell/workflow/WorkflowWizardDatasetInputs.ts`):
  - replacement equality now includes version/title semantics (not only asset id),
  - canonical dataset id/version guards prevent malformed references,
  - non-dataset inputs remain isolated during dataset replacement.
- Step draft persistence consistency (`ui/studio-shell/workflow/WorkflowWizardSteps.ts`):
  - canonical agent/assistant asset id/version guards prevent malformed step references.
- Rehydration resilience in wizard surfaces:
  - inputs/steps now surface bounded unavailable/deleted asset warnings when attached references are no longer in selector catalog results.
- Rehydration performance:
  - dataset and agent selector adapters now include short-lived bounded in-memory query caching to reduce redundant refetches across reopen/navigation/rehydration cycles.

Selector session <-> workflow draft model:
- Canonical persistence lives in workflow draft inputs/steps only.
- Selector session store remains interaction-scoped state (pending, lifecycle, validation), synchronized from canonical draft references.
- Rehydration restores selector-aligned state from canonical draft without introducing UI-only persistence artifacts.

## Story 4.13 (Epic 4 closeout): Cross-story tests and documentation hardening
Epic 4 closeout adds integration-level regression coverage across the full selector lifecycle in:
- `ui/studio-shell/asset-selector/tests/AssetSelectorFramework.integration.test.ts`

Closeout coverage now validates:
- Domain contract and application capability matrix enforcement at shared session boundaries.
- Dataset and agent selectors reusing the same session/lifecycle infrastructure without cross-session conflicts.
- Create-new launch and return handoff restoring the targeted selector session and preserving existing selections.
- Workflow draft synchronization for both dataset inputs and agent-backed steps during selector confirm flows.
- Stale and malformed return payloads failing safely without corrupting selected state.
- Workflow draft persistence round-trip (`serializeWorkflowDraft`/`deserializeWorkflowDraft`) preserving canonical selector-linked references.
- Duplicate/non-canonical dataset references being filtered during replacement so save/load flows do not introduce duplicate/orphaned selector references.

System responsibility split (must remain stable):
- Shared framework responsibilities:
  - Contract and validation: `domain/studio-shell/AssetSelectorContract.ts`
  - Capability matrix: `application/studio-entry/AssetSelectorCapabilityRegistry.ts`
  - Selector lifecycle/session model: `application/studio-entry/AssetSelectorSessionStore.ts`
  - Shared selector shell UI: `ui/components/studio-shell/asset-selector/AssetSelectorShell.tsx`
  - Shared create-new launch/return seams: `AssetSelectorStudioLaunchService` + `AssetSelectorReturnHandoffService`
- Asset-specific responsibilities:
  - Request construction and registry mapping in selector adapters (`DatasetAssetSelectorAdapter`, `AgentAssistantAssetSelectorAdapter`)
  - Draft mutation semantics in workflow helpers (`WorkflowWizardDatasetInputs`, `WorkflowWizardSteps`)
  - Feature-surface wiring in workflow section editors

Future selector-backed asset-type adoption guidance:
1. Add/extend capability mapping for the new usage context/asset type in `AssetSelectorCapabilityRegistry`.
2. Implement an asset-specific adapter that only handles request defaults, taxonomy filters, and result mapping.
3. Reuse shared session store + shared shell + shared launch/return services; do not fork lifecycle logic in feature UI.
4. Persist only canonical references in workflow draft seams; treat selector session state as interaction-scoped.
5. Add one cross-story integration test that exercises request validation, create-new return handling, and persistence round-trip for the new type.

## Story 4.13: Studio Shell authoring promotion and configurable toolbar contract
- Studio Shell registration contracts now include an optional shell toolbar configuration (`ui/studio-shell/StudioShellExtensions.ts`) with typed actions:
  - `refresh-snapshot`
  - `save-draft`
  - `run-validation`
  - `set-workflow-mode`
- Toolbar configuration is registration-owned (not user-authored) and validated/normalized at registration boundaries (required action ids/labels, duplicate-action rejection, workflow-mode validation).
- `StudioShellPage` now renders draft authoring as a primary top-level section outside and above the shell card grid, while keeping existing session/metadata/dependencies/lifecycle/validation cards and extension slots intact.
- Workflow Studio now demonstrates per-studio toolbar configuration through registration metadata (`ui/studio-shell/registrations/WorkflowStudioRegistration.ts`) with wizard/canvas mode actions plus save/validate/refresh controls.
- Toolbar execution reuses existing shell orchestration seams (shared workflow mode state store and existing draft/validation operations) without bypassing selector/session infrastructure or duplicating validation logic.

## Direction 5 stories 5.1-5.2: Canonical studio launch/return contract
- Cross-studio selector create-new launches now also carry a canonical studio handoff contract (`ui/routes/StudioHandoffContract.ts`) in addition to legacy query params.
- Workflow Studio origin launches build this contract through `ui/studio-shell/workflow/WorkflowStudioLaunchContext.ts`, including origin route, workflow draft reference/state, selector target context, and return/resume destination.
- `InlineAssetCreationService` remains backward-compatible with existing selector query params and now falls back to parsing the canonical contract when those params are absent.

## Direction 5 stories 5.3-5.4: Shared return resolution + workflow session persistence
- Return payload resolution is now centralized in `ui/routes/StudioReturnPayloadResolution.ts`:
  - typed resolution (`created`, `cancelled`, `no-selection`, `invalid`)
  - canonical payload validation and selector-target extraction from handoff context
- `AssetSelectorReturnHandoffService` now uses that shared resolver and explicitly supports `no-selection` without mutating selected assets.
- Workflow return restoration now uses canonical handoff origin context via `ui/studio-shell/workflow/WorkflowStudioReturnRestorationService.ts` (mode + draft snapshot + draft/session reference restore).
- Workflow authoring state persistence now lives in `WorkflowStudioModeStateStore` local-storage snapshots keyed by studio id, preserving in-progress draft sections (`triggers`, `inputs`, `steps`, `outputs`) through launch/return and refresh flows.

## Story 4.14: Workflow wizard focus and layout hardening
- Wizard mode now prioritizes page authoring flow by rendering the active wizard page directly under page buttons in the primary wizard card (`WorkflowStudioWizardModeSurface`).
- The per-section readiness label row was removed from the default surface to reduce redundant readiness copy in the main authoring path.
- Wizard focus/progress details now render directly under the page buttons, while primary Back/Next actions sit on the page-nav rail and are also duplicated inline under the Trigger page content.
- Workflow readiness details remain available but now sit at the bottom of the wizard stack as a collapsed disclosure (`details/summary`), so diagnostics are opt-in rather than always expanded.
- These changes stay in renderer presentation seams and preserve existing selector/session/capability integration paths for workflow inputs and steps.

## Adding future asset types
To add a new selector type without modifying shared shell/session layers:
1. Add a typed adapter in `ui/studio-shell/asset-selector/` that:
   - builds canonical `AssetSelectorRequest` for the target asset type and usage context
   - queries/mapping from the asset source into `AssetSelectorResultItem`
2. Register/validate capability matrix support in `application/studio-entry/AssetSelectorCapabilityRegistry.ts`.
3. Integrate the adapter into the target workflow/studio surface using:
   - shared session store (`AssetSelectorSessionStore`)
   - shared shell UI (`AssetSelectorShell`)
4. Keep asset-type-specific behavior in adapter/feature seams; avoid branching inside shared shell/session classes.

## Extensibility model
- New usage contexts can be registered without changing validator logic.
- New asset-type allowances are configuration-driven via registry descriptors.
- Existing flows remain stable because checks run through the same registry/service seam.

## Integration readiness
Epic 4 selector integration is now active in Workflow Wizard inputs and steps:
- Inputs: selector-backed dataset multi-select with inline create-new return.
- Steps: selector-backed agent/assistant add + replace flows with ordered-step compatibility.
- Shared shell/session/capability/return seams are reused without parallel selector pathways.

Workflow Canvas integration now also reuses the same shared selector seams for dataset-linked input nodes and agent-linked step nodes:
- Canvas selectors run through the same shared session store + adapter + shell contracts.
- Confirmed canvas selections persist canonical references in `WorkflowDraft.inputs[].asset` and `WorkflowDraft.steps[].assetRef` (no canvas-only reference model).
