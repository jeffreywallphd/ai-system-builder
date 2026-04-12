# Image Workflow Input/Output Binding Contracts

This note documents Story 2.1.4 for the image manipulation vertical slice: typed input/output binding contracts that connect workflow slot definitions to system-level logical asset bindings.

## Canonical files

- `src/shared/contracts/image-workflows/ImageWorkflowBindingContracts.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowBindingContracts.test.ts`
- `docs/architecture/image-workflow-input-output-binding-contracts.ai.md`

## Contract model

The binding contract layer defines two authoritative resources:

- `ImageWorkflowBindingContract` (workflow-facing contract)
- `ImageSystemBindingContract` (system-facing binding selections)

### Workflow-facing slot contracts

`ImageWorkflowBindingContract` declares:

- `inputSlots[]` with explicit slot identity, purpose, required/optional flags, cardinality, min/max counts, and compatibility metadata (`allowedAssetClasses`, `allowedMediaClasses`)
- `outputSlots[]` with explicit slot identity, required/optional flags, cardinality, and emitted compatibility metadata (`emittedAssetClasses`, `emittedMediaClasses`)
- semantic source-slot purposes including:
  - required `source-image` slot support
  - optional `mask-image` slot support
  - optional `reference-image` slot support

### System-facing binding contracts

`ImageSystemBindingContract` declares:

- `inputBindings[]` keyed by workflow input slot id
- `assets[]` per input binding, each represented as a logical asset reference (`assetReferenceId`) with declarative class/media metadata
- `outputBindings[]` keyed by workflow output slot id
- logical output target reference (`targetReference`) plus accepted asset/media class constraints

No path-based filesystem references are allowed; all references are logical identifiers.

## Validation semantics

The contract layer enforces:

- unique workflow slot ids and unique system binding ids/slot ids
- workflow contract requirement for at least one required `source-image` input slot
- cardinality bounds for input and output slots
- logical reference safety (rejects filesystem path assumptions)
- compatibility validation between workflow constraints and system selections:
  - required input/output bindings present
  - unknown slot binding detection
  - input asset class/media compatibility checks
  - output accepted class/media compatibility checks

`validateImageSystemBindingContract(...)` returns a structured validation result with issue codes suitable for workflow configuration UX, run preflight validation, and later orchestration mapping.

## Architecture boundary posture

- Contracts are reusable across studio authoring, runtime preflight, and adapter translation layers.
- Contracts use logical asset ids and slot semantics, preserving the protected asset model.
- Contracts remain backend-agnostic and do not embed ComfyUI JSON or storage-path assumptions.

## Related architecture notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
