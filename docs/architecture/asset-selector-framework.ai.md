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

## Extensibility
- New usage contexts can be added by registry registration.
- New allowed asset-type mappings per context are configuration-driven.
- Existing validator code does not require refactor for new context/type combinations.

## Scope boundaries
- No selector UI implementation in this slice.
- No workflow canvas/wizard wiring in this slice.
- This is the reusable contract + capability truth foundation for later stories.
