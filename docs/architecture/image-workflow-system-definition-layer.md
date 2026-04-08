# Image Workflow and System Definition Layer Architecture

This note documents Story 2.1.5 for Feature 2 / Epic 2.1: the production architecture for typed image workflows and runnable image systems as authoritative platform resources.

## Purpose

The image manipulation vertical slice defines how user intent is represented before execution:

- workflow definitions provide reusable typed contracts
- system definitions provide runnable user-facing configuration pinned to a workflow version
- parameter and binding contracts provide cross-layer validation seams
- translation metadata provides backend mapping seams without making backend payloads authoritative

This note is the reference implementation baseline for later AI capabilities that need the same workflow -> system -> execution contract posture.

Story 2.2.5 extends this baseline with authoritative query/list use cases so workflow/system discovery and reopen flows are driven by persisted platform metadata, not studio-local cache state.
Story 2.2.6 extends the baseline with reusable readiness validation services so draft/incomplete/valid/runnable posture is evaluated consistently before later run-submission orchestration consumes definitions.
Story 2.3.1 extends the baseline with an explicit initial supported workflow template set so authoring and downstream translation targets remain bounded and deterministic.
Story 2.3.2 extends the baseline with internal translation-ready metadata for supported templates and consistency checks that keep translation descriptors aligned with typed requirements.
Story 2.3.3 extends the baseline with template-level defaults, parameter guidance, and reusable presets so image workflows are usable without exposing backend tuning jargon.
Story 2.3.4 extends the baseline with explicit compatibility/capability metadata on supported templates plus readiness-evaluation seams for node capability and backend translation eligibility checks.
Story 8.2.2 hardens workflow/system configuration handling for stale, incomplete, or incompatible saved definitions by applying stricter cross-definition compatibility checks in authoring, reopen/query, and run-submission readiness paths.

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
- `src/application/image-workflows/ImageWorkflowSystemReadinessValidationService.ts`
- `src/application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry.ts`

Initial supported workflow template families for this slice:

- `image-to-image` (`image-template:image-to-image-restyle:v1`)
- `enhance-upscale` (`image-template:enhance-upscale:v1`)
- `mask-guided-edit` (`image-template:mask-guided-edit:v1`)

Template metadata split for translation-ready templates:

- `display`: user-facing text surfaced by Studio and API projections.
- `compatibility`: operation capability requirements, required input/output kinds, translation backend family identifiers, and readiness-check toggles.
- `translation`: internal adapter metadata (translation key, capability hints, input/parameter/output mapping descriptors).
- `configuration`: default parameter values, recommended ranges, guardrails, and reusable preset profiles for form initialization and future system baseline cloning.

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

ComfyUI adapter consumption rule for Story 2.3.2:

- use translation metadata keys to resolve adapter-internal graph templates;
- keep raw ComfyUI graph JSON/prompt/history payloads out of workflow/system definition contracts and user-facing APIs.

Template compatibility consumption rule for Story 2.3.4:

- consume `resolveCompatibilityMetadataForOperationKind(...)` and `evaluateCompatibilityReadinessForOperationKind(...)` from `InitialSupportedImageWorkflowTemplateRegistry` for deterministic capability/backend-family readiness checks;
- keep these checks in application/service layers and do not re-implement them as UI-only heuristics.

## Versioning and evolution seams

Workflow evolution is explicit and safe-by-default:

- `bumpImageWorkflowVersion(...)` creates draft successors on the same lineage
- lifecycle transitions enforce publication readiness
- activation is lifecycle-gated

System evolution is explicit and revalidation-friendly:

- `rebindImageSystemWorkflow(...)` re-pins workflow version and resets system to `draft` + `disabled`
- `evaluateImageSystemReadiness(...)` is the runnable gate for lifecycle/runtime transitions

This protects later translation/orchestration stories from silent contract drift.

Story 8.2.2 hardening posture for stale/incompatible saved systems:

- system binding compatibility now enforces both directions:
  - system-required ids must exist in workflow declarations
  - workflow-required ids must remain represented in system binding requirements
- stale configured selections are rejected when:
  - input selections reference unknown workflow input ids
  - output targets reference unknown workflow output ids
  - parameter baselines include unknown workflow parameter ids
- system query/reopen readiness now degrades to `configuration-incomplete` when:
  - the bound workflow cannot be resolved
  - workflow lineage/version/revision pinning mismatches the resolved workflow
  - workflow/system binding compatibility issues are detected by shared application validation

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

For discovery/reopen experiences specifically:

- use application read/list use cases as the metadata source for picker/detail surfaces
- keep workspace + actor scope explicit in every query request
- treat list results as authorization-filtered, authoritative summaries for reopen targets
- do not restore systems/workflows from UI-local snapshots when authoritative definitions are available

Studio lifecycle rule (Story 2.4.3):

- system save, update, and reopen flows must use authoritative image-system create/update/query seams so workflow selection, parameter baselines, and readiness posture come from persisted definitions rather than transient UI state.

Do not add new AI capability surfaces that bypass workflow/system contracts via direct runtime payload editing.

## Related architecture notes

- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/image-workflow-initial-supported-set.md`
- `docs/architecture/workflow-execution-and-tools.md`
- `docs/architecture/comfyui-adapter-audit.md`
- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/studio-handoff-contract.md`
