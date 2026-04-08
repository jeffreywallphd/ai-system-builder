# Image Workflow and System Definition Layer Architecture

This note documents Story 2.1.5 for Feature 2 / Epic 2.1: the production architecture for typed image workflows and runnable image systems as authoritative platform resources.

## Purpose

The image manipulation vertical slice defines how user intent is represented before execution:

- workflow definitions provide reusable typed contracts
- system definitions provide runnable user-facing configuration pinned to a workflow version
- parameter and binding contracts provide cross-layer validation seams
- translation metadata provides backend mapping seams without making backend payloads authoritative

This note is the reference implementation baseline for later AI capabilities that need the same workflow -> system -> execution contract posture.

## Canonical implementation seams

Domain resources:

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/domain/image-workflows/ImageWorkflowParameterSpecification.ts`
- `src/domain/systems/ImageSystemDomain.ts`

Shared contracts:

- `src/shared/contracts/image-workflows/ImageWorkflowParameterContracts.ts`
- `src/shared/contracts/image-workflows/ImageWorkflowBindingContracts.ts`

Image workflow asset definitions used by Studio-facing configuration:

- `src/application/contracts/ImageWorkflowAssetContract.ts`
- `src/application/contracts/ImageWorkflowInputBindingConfiguration.ts`
- `src/application/contracts/ImageWorkflowOutputBindingConfiguration.ts`
- `src/application/contracts/ImageWorkflowUiTriggerBindingConfiguration.ts`
- `src/application/contracts/ImageWorkflowAssetRegistry.ts`

## Layered model and responsibilities

### 1) Workflow definitions (`ImageWorkflowDefinition`)

`ImageWorkflowDefinition` is the typed, versioned contract for an image workflow:

- typed inputs (`inputSlots`, `inputBindings`)
- typed parameters (`parameterSpecifications`)
- typed outputs (`outputExpectations`, `outputBindings`)
- version lineage (`lineageId`, semantic `versionTag`, `revision`, `supersedesWorkflowId`)
- publication lifecycle and activation rules
- backend translation references (`backendTranslation`) for later runtime adapters

A workflow definition is not per-user run state and is not a ComfyUI payload.

### 2) System definitions (`ImageSystemDefinition`)

`ImageSystemDefinition` is the durable runnable configuration layer:

- binds to a specific workflow version (`workflowBinding`)
- captures selected input asset references (`inputAssetSelections`)
- captures output target references (`outputTargetBindings`)
- captures parameter baseline and profile references (`parameterBaseline`)
- enforces runnable posture via lifecycle/runtime status and readiness evaluation

A system is where "how this workflow should run for this use case" is saved and reopened.

### 3) Parameter contracts (workflow -> system value validation)

`ImageWorkflowParameterContracts` defines shared validation contracts so system and run paths validate values against workflow specifications using stable issue codes:

- unknown parameter
- missing required value
- invalid value

This keeps parameter validation backend-authoritative and reusable across Studio/UI/API boundaries.

### 4) Input/output binding contracts (workflow -> system asset/target compatibility)

`ImageWorkflowBindingContracts` defines workflow slot contracts and system binding contracts, then validates compatibility:

- required slot presence
- cardinality
- asset/media class compatibility
- unknown slot detection
- workflow/system identity mismatch

This is the seam that keeps asset and output binding semantics typed and inspectable before execution.

## Authoritative source of truth posture

The platform source of truth for this slice is:

1. typed workflow definitions
2. typed system definitions
3. typed parameter and binding contracts

The following are explicitly not source-of-truth resources:

- raw ComfyUI graph JSON/prompt/history payloads
- UI-local form state or page component state
- filesystem paths or ad hoc adapter metadata

ComfyUI remains an infrastructure execution adapter boundary. Studio/UI layers remain authoring and projection surfaces over domain/application contracts.

## Versioning and evolution seams

Workflow evolution is explicit and safe-by-default:

- `bumpImageWorkflowVersion(...)` creates draft successors on the same lineage
- lifecycle transitions enforce publication readiness
- activation is lifecycle-gated

System evolution is explicit and revalidation-friendly:

- `rebindImageSystemWorkflow(...)` re-pins workflow version and resets system to `draft` + `disabled`
- `evaluateImageSystemReadiness(...)` is the runnable gate for lifecycle/runtime transitions

This protects later translation/orchestration stories from silent contract drift.

## Binding and translation boundary rules

Required boundary rules in this slice:

- all input/output/profile/asset references are logical identifiers, not filesystem paths
- required workflow inputs/outputs/parameters must be representable in system bindings/baselines
- backend translation mappings must resolve to declared workflow input/parameter/output ids
- published/ready states require completeness/readiness checks, not UI assumptions

These rules establish deterministic preflight semantics before orchestration starts.

## Downstream guidance for later AI capabilities

Later capabilities should reuse this pattern:

- define durable typed workflow contracts first
- define runnable system definitions separately from workflow authoring
- keep parameter and binding validation in shared contract layers with stable issue codes
- keep backend/runtime payloads adapter-bounded and derived from authoritative definitions

Do not add new AI capability surfaces that bypass workflow/system contracts via direct runtime payload editing.

## Related architecture notes

- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/workflow-execution-and-tools.md`
- `docs/architecture/comfyui-adapter-audit.md`
- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/studio-handoff-contract.md`
