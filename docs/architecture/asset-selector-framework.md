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
The contract is ready for:
- Workflow wizard input selectors (future Story 4.9)
- Workflow step selectors (future Story 4.10)
- Studio handoff integration boundaries (future Epic 5)

No selector UI is introduced in this slice.
