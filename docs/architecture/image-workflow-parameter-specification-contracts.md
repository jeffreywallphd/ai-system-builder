# Image Workflow Parameter Specification Contracts

This note documents Story 2.1.3 for the image manipulation vertical slice: typed parameter specifications and shared validation contracts for workflow-defined forms and system-level parameter values.

## Canonical files

- `src/domain/image-workflows/ImageWorkflowParameterSpecification.ts`
- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/shared/contracts/image-workflows/ImageWorkflowParameterContracts.ts`
- `src/domain/image-workflows/tests/ImageWorkflowParameterSpecification.test.ts`
- `src/domain/image-workflows/tests/ImageWorkflowDomain.test.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowParameterContracts.test.ts`

## Domain value object

`ImageWorkflowParameterSpecification` defines workflow parameters as typed, validated platform resources.

Core fields include:

- identity and description: `parameterId`, `label`, optional `description`
- semantic intent: `semanticMeaning`
- typed value surface: `valueKind`
- requirement and defaulting: `required`, optional `defaultValue`
- sensitivity classification: `sensitivity`
- validation metadata: `validation` (numeric bounds and step, text rules, select options, accepted asset kinds)
- conditional visibility: `visibility.mode` and `visibility.rules[]`
- rendering hints: `ui` (control type, ordering, grouping, helper text, placeholder, unit)

## Value kinds supported

- `text`
- `integer`
- `float`
- `boolean`
- `select`
- `image-asset-reference`
- `mask-asset-reference`
- `reference-asset-reference`

## Invariants and validation semantics

Domain normalization enforces:

- required identifiers/labels and valid enumerations
- type-compatible validation metadata (for example numeric bounds only on integer/float)
- select parameters requiring explicit options
- asset-reference constraints restricted to asset-reference value kinds
- valid regex patterns for text constraints
- UI control compatibility with value kind
- valid visibility expressions and no self-referencing visibility rules
- default values matching declared type and constraints

`validateImageWorkflowParameterValue(...)` evaluates runtime/system values against the specification and returns explicit messages for constraint violations.

## Shared contract layer

`ImageWorkflowParameterContracts.ts` defines reusable contracts for application/API/studio layers:

- `ImageWorkflowParameterDefinitionContract`: workflow-scoped parameter definition envelope
- `ImageSystemParameterSetContract`: system/workflow parameter value set envelope
- `validateImageSystemParameterSetContract(...)`: cross-layer validator with issue codes:
  - `unknown-parameter`
  - `required-value-missing`
  - `invalid-value`

This provides a typed validation seam for system configuration and runtime submission without freeform raw JSON editing.

## Architecture boundary posture

- Domain and shared contracts remain backend-agnostic and storage-agnostic.
- Semantic parameter meaning is separated from UI rendering hints.
- UI schema hints are portable across desktop and future thin-client surfaces.
- Contracts are extensible for additional parameter kinds/controls in later workflow stories.
