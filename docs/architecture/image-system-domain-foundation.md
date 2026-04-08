# Image System Domain Foundation

This note documents Story 2.1.2 for the image manipulation vertical slice: a dedicated domain model for image systems that bind typed workflow definitions into durable, reopenable, runnable system configurations.

## Canonical files

- `src/domain/systems/ImageSystemDomain.ts`
- `src/domain/systems/tests/ImageSystemDomain.test.ts`

## Workflow definition vs system definition

The platform now models these as separate resources with different responsibilities:

- `ImageWorkflowDefinition` (`src/domain/image-workflows/ImageWorkflowDomain.ts`) defines reusable workflow contracts: typed inputs/parameters/outputs, lifecycle/versioning, and backend translation seams.
- `ImageSystemDefinition` (`src/domain/systems/ImageSystemDomain.ts`) defines reusable user-facing runnable configuration: workspace-scoped identity, display metadata, workflow version binding, selected assets, output targets, parameter baselines/profile references, and lifecycle/runtime posture.

This separation keeps workflow authoring independent from per-system saved state and preserves clean architecture boundaries for run orchestration and storage.
Story 2.1.3 complements this by adding shared parameter-set validation contracts so system parameter values are checked against workflow parameter specifications through typed contracts.

## Domain model

`ImageSystemDefinition` carries:

- identity and scope: `systemId`, `ownership.workspaceId`, optional `ownership.ownerUserId`, `ownership.visibility`, optional sharing policy refs
- display metadata: `display.title`, optional `summary`, deduplicated `tags`
- workflow pinning seam: `workflowBinding.workflowId`, `workflowLineageId`, `workflowVersionTag`, `workflowRevision`, and required input/parameter/output ids
- saved runnable configuration:
  - `inputAssetSelections[]` for selected assets bound to workflow inputs
  - `outputTargetBindings[]` for required output destination bindings
  - `parameterBaseline.values` and `parameterBaseline.profileReferences`
- lifecycle/runtime posture: `lifecycleState` (`draft|ready|archived`) and `runtimeStatus` (`enabled|disabled`)
- continuity seam for future lineage: `lineage.latestRunId`, `lineage.latestRunOccurredAt`, and `lineage.latestOutputAssetIds`
- audit metadata: `createdBy`, `lastModifiedBy`, `createdAt`, `updatedAt`

## Invariants enforced in domain code

- Private systems require owner user identity.
- Workflow binding workspace must match system workspace scope.
- Bound workflow version tags must be semantic version formatted (`major.minor.patch`), with non-negative revisions.
- Logical references reject filesystem paths for selected asset references, output targets, and parameter profile references.
- Input and output binding identifiers are deduplicated and constrained to bound workflow required ids.
- Lifecycle/runtime compatibility:
  - only `ready` systems can be `enabled`
  - `archived` systems must be `disabled`
- `ready` systems must satisfy readiness requirements.

## Readiness and runnable semantics

`evaluateImageSystemReadiness(...)` reports contract-level readiness issues when:

- required workflow inputs are missing selected assets,
- required workflow outputs are missing target bindings,
- required workflow parameters are unresolved (neither explicit baseline values nor profile references available).

`isImageSystemRunnable(...)` is true only when:

- lifecycle is `ready`,
- runtime status is `enabled`, and
- readiness evaluation returns no issues.

## Lifecycle and evolution seams

- `transitionImageSystemLifecycle(...)` enforces explicit transitions and blocks promotion to `ready` when not runnable.
- `setImageSystemRuntimeStatus(...)` enforces readiness and lifecycle compatibility when enabling/disabling runtime posture.
- `rebindImageSystemWorkflow(...)` allows retargeting to a new workflow version while resetting system posture to `draft` + `disabled` for safe revalidation.

## Architecture boundary posture

- Domain model is infrastructure-agnostic and does not embed ComfyUI graph JSON.
- No UI framework, transport, filesystem, or database details are encoded in the entity.
- The model is designed for later orchestration and lineage features without redesigning the system/workflow contract boundary.

## Related architecture notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
