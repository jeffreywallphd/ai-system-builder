# AI Companion: Image Workflow/System Definition Layer Architecture

## Why this note exists

Story 2.1.5 defines the architecture contract for the image manipulation slice so later translation, orchestration, and UI integration work builds on typed, reusable platform resources.
Story 2.2.5 adds the authoritative query/list seam used by workflow/system discovery and reopen behavior.
Story 2.2.6 adds a reusable readiness validation service seam used by authoring and query flows so incomplete/invalid definitions are surfaced consistently before run submission.
Story 2.3.1 adds an explicit initial supported workflow template set for bounded authoring and translation-ready operation scope.
Story 2.3.2 adds internal translation metadata for supported templates with consistency checks so backend adapters can translate without leaking backend graph shape into workflow/system source-of-truth models.

## Canonical seams

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/domain/image-workflows/ImageWorkflowParameterSpecification.ts`
- `src/domain/systems/ImageSystemDomain.ts`
- `src/shared/contracts/image-workflows/ImageWorkflowParameterContracts.ts`
- `src/shared/contracts/image-workflows/ImageWorkflowBindingContracts.ts`
- `src/application/contracts/ImageWorkflowAssetContract.ts`
- `src/application/contracts/ImageWorkflowAssetRegistry.ts`
- `src/application/image-workflows/ImageWorkflowSystemReadinessValidationService.ts`
- `src/application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry.ts`

Initial supported template families:

- `image-to-image` (`image-template:image-to-image-restyle:v1`)
- `enhance-upscale` (`image-template:enhance-upscale:v1`)
- `mask-guided-edit` (`image-template:mask-guided-edit:v1`)

Template metadata split (Story 2.3.2):

- `display`: user-facing labels and rationale
- `translation`: internal keys, capability hints, and mapping descriptors used by adapters

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

Adapter rule:

- resolve adapter graph/prompt payloads from `translation` identifiers inside infrastructure adapters only; do not expose graph JSON or node ids via workflow/system contracts.

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

Discovery/reopen rule:

- read/list workflow/system definitions through authoritative application APIs/use cases, not local studio-only state snapshots.

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/image-workflow-initial-supported-set.md`
