# AI Companion: Image Workflow Parameter Specification Contracts

## What this slice adds

Story 2.1.3 introduces a dedicated parameter-specification value object and shared contracts so image workflows expose typed form definitions instead of raw JSON payload assumptions.

## Canonical files

- `src/domain/image-workflows/ImageWorkflowParameterSpecification.ts`
- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/shared/contracts/image-workflows/ImageWorkflowParameterContracts.ts`
- `src/domain/image-workflows/tests/ImageWorkflowParameterSpecification.test.ts`
- `src/domain/image-workflows/tests/ImageWorkflowDomain.test.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowParameterContracts.test.ts`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`

## Parameter model coverage

`ImageWorkflowParameterSpecification` now captures:

- typed value kinds: text, integer, float, boolean, select, image-asset reference, mask-asset reference, reference-asset reference
- semantic meaning separate from rendering (`semanticMeaning`)
- explicit sensitivity classification (`normal|sensitive|secret`)
- typed validation metadata (numeric bounds/step, text length/pattern, select options, accepted asset kinds)
- explicit UI schema hints (`ui.control`, ordering, grouping, helper text, placeholders, units)
- visibility rules with composable operators for form-level conditional rendering

## Validation posture

- Domain normalization enforces value-kind specific invariants.
- UI control compatibility is validated against value type to keep rendering portable.
- Default values are validated against type and constraints.
- Visibility rules reject invalid operators, malformed values, and self-reference.
- Shared contract validation checks system parameter value sets against workflow parameter specifications.

## Workflow vs system contract seam

- Workflow resources publish canonical parameter definitions.
- System resources and runtime callers submit parameter value sets through shared contracts.
- Shared validators emit structured issue codes for unknown parameters, missing required values, and invalid values.

## Boundary posture

- No ComfyUI JSON or desktop-only widget assumptions in domain/shared contracts.
- UI hints are present but optional and surface-agnostic.
- Contract design preserves extension seams for future advanced image workflows.
