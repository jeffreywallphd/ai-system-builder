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
