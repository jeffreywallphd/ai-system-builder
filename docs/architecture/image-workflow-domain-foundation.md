# Image Workflow Domain Foundation

This note documents Story 2.1.1 for the image manipulation vertical slice: a dedicated domain model for typed image workflows with lifecycle and publication invariants.

## Canonical files

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/domain/image-workflows/ImageWorkflowParameterSpecification.ts`
- `src/domain/image-workflows/tests/ImageWorkflowDomain.test.ts`
- `src/domain/image-workflows/tests/ImageWorkflowParameterSpecification.test.ts`

## Domain model

`ImageWorkflowDefinition` is a workspace-scoped protected resource that models image manipulation workflows as authoritative platform data.

Canonical fields include:

- identity and scope: `workflowId`, `ownership.workspaceId`, optional `ownership.ownerUserId`, `ownership.visibility`
- display metadata: `display.title`, optional `summary`, deduplicated `tags`
- type taxonomy: `workflowType`, `category`, `operationKind`
- version lineage: `version.lineageId`, semantic `version.versionTag`, numeric `revision`, optional `supersedesWorkflowId`
- lifecycle and activation: `lifecycleState`, `activationStatus`
- typed inputs: `inputSlots[]` and `inputBindings[]`
- typed parameters: `parameterSpecifications[]` with explicit semantic meaning, validation metadata, visibility rules, and UI schema hints
- typed outputs: `outputExpectations[]` and `outputBindings[]`
- backend translation seam: `backendTranslation` (translator id, contract version, template id, and typed input/parameter/output field mappings)
- audit metadata: `createdBy`, `lastModifiedBy`, `createdAt`, `updatedAt`

## Invariants enforced in domain code

- Operation kind must be from the canonical image manipulation set (`image-to-image`, `restyle`, `enhance-upscale`, `mask-guided-edit`, `batch-transform`).
- Private workflows require owner user identity.
- Version tags must use semantic version format (`major.minor.patch`).
- Lifecycle transitions are explicit and guarded (`draft -> review -> published -> deprecated -> retired`, with bounded reversibility).
- Activation is constrained by lifecycle:
  - only `published` workflows may be `active`
  - `retired` workflows must be `inactive`
- Input/output/parameter identifiers and binding identifiers must be unique.
- Input/output/backend binding references must resolve to declared slot/parameter/output ids.
- Input binding source keys and translation fields are logical references and reject filesystem path assumptions.
- Parameter defaults and runtime values are validated by value-kind specific parameter specification rules.
- `published` workflows must satisfy completeness checks:
  - at least one input and output
  - required inputs and outputs have binding rules
  - required inputs/parameters/outputs are mapped in backend translation

## Lifecycle and evolution seams

- `transitionImageWorkflowLifecycle(...)` enforces state transition policy and publication readiness.
- `setImageWorkflowActivationStatus(...)` enforces activation/lifecycle compatibility.
- `bumpImageWorkflowVersion(...)` creates a new draft successor under the same lineage with incremented revision and `supersedesWorkflowId` linkage.

## Architecture boundary posture

- Domain model is infrastructure-agnostic.
- No ComfyUI graph JSON is embedded in domain entities.
- No React, Electron, HTTP, filesystem, or SQLite details are present.
- Workflow execution adapter details are represented only through typed backend translation references.

## Related architecture notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
