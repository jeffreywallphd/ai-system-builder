# AI Companion: Image Workflow/System Definition Layer Architecture

## Why this note exists

Story 2.1.5 defines the architecture contract for the image manipulation slice so later translation, orchestration, and UI integration work builds on typed, reusable platform resources.

## Canonical seams

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/domain/image-workflows/ImageWorkflowParameterSpecification.ts`
- `src/domain/systems/ImageSystemDomain.ts`
- `src/shared/contracts/image-workflows/ImageWorkflowParameterContracts.ts`
- `src/shared/contracts/image-workflows/ImageWorkflowBindingContracts.ts`
- `src/application/contracts/ImageWorkflowAssetContract.ts`
- `src/application/contracts/ImageWorkflowAssetRegistry.ts`

## Layer model

- Workflow definition: reusable typed contract for inputs, parameters, outputs, lifecycle, version lineage, and backend translation mappings.
- System definition: runnable, reopenable configuration pinned to a workflow version with input selections, output targets, and parameter baselines.
- Shared contracts: parameter and binding validators that enforce cross-layer compatibility with stable issue codes.

## Source-of-truth posture

Authoritative resources are typed workflow/system definitions plus shared contracts.

Not authoritative:

- raw ComfyUI JSON/prompt/history payloads
- UI-local form/canvas state
- filesystem paths in bindings/references

ComfyUI remains an adapter boundary; Studio remains a projection/configuration surface.

## Versioning/readiness seams

- Workflow versioning uses lineage + semantic version tags + explicit lifecycle/activation constraints.
- System rebind to a new workflow version resets runtime posture for safe revalidation.
- Published workflow and ready system states are gated by completeness/readiness checks in domain/contracts, not UI heuristics.

## Reference-implementation guidance

Use this image slice as the baseline for later AI capabilities:

- keep workflow definitions and system definitions separate
- keep parameter/binding validation contract-first
- keep runtime payloads derived from typed definitions
- do not bypass domain/application contracts with direct runtime JSON editing

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
