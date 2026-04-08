# AI Companion: Image Workflow and System API Contracts

## What this slice adds

Story 2.2.1 defines shared API DTO/schema contracts for image workflow and image system configuration flows across desktop and thin-client surfaces.
Story 2.2.2 adds application-layer repository/service ports for authoritative workflow/system persistence and policy-aware resolution.
Story 2.2.3 adds application use cases for authoritative image-workflow create/update authoring.
Story 2.2.4 adds application use cases for authoritative image-system create/update authoring with workflow-binding compatibility and readiness outputs.
Story 2.2.5 adds application query/list use cases for authoritative workflow/system discovery and reopen surfaces.

## Canonical files

- `src/shared/contracts/image-workflows/ImageWorkflowSystemApiContracts.ts`
- `src/shared/dto/image-workflows/ImageWorkflowSystemApiDtos.ts`
- `src/shared/schemas/image-workflows/ImageWorkflowSystemApiSchemaContracts.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowSystemApiContracts.test.ts`
- `src/shared/dto/image-workflows/tests/ImageWorkflowSystemApiDtos.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageWorkflowSystemApiSchemaContracts.test.ts`
- `src/application/image-workflows/ports/ImageWorkflowSystemDefinitionPorts.ts`
- `src/application/image-workflows/CreateImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/UpdateImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/ImageWorkflowDefinitionAuthoringContracts.ts`
- `src/application/image-workflows/ImageWorkflowDefinitionAuthoringErrors.ts`
- `src/application/image-workflows/CreateImageSystemDefinitionUseCase.ts`
- `src/application/image-workflows/UpdateImageSystemDefinitionUseCase.ts`
- `src/application/image-workflows/ImageSystemDefinitionAuthoringContracts.ts`
- `src/application/image-workflows/ImageSystemDefinitionAuthoringErrors.ts`
- `src/application/image-workflows/GetImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/ListImageWorkflowDefinitionsUseCase.ts`
- `src/application/image-workflows/GetImageSystemDefinitionUseCase.ts`
- `src/application/image-workflows/ListImageSystemDefinitionsUseCase.ts`
- `src/application/image-workflows/ImageWorkflowSystemQueryContracts.ts`
- `src/application/image-workflows/ImageWorkflowSystemQueryErrors.ts`
- `src/application/image-workflows/ImageWorkflowSystemQueryShared.ts`
- `src/application/image-workflows/tests/ImageWorkflowSystemDefinitionPorts.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowDefinitionAuthoringUseCases.test.ts`
- `src/application/image-workflows/tests/ImageSystemDefinitionAuthoringUseCases.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowSystemQueryUseCases.test.ts`
- `docs/architecture/image-workflow-system-api-contracts.md`

## Contract coverage

- Workflow API contracts:
  - create/update/read/list requests and responses
  - typed workflow definition payload
  - version metadata and compatibility metadata
  - readiness and validation result projections
- System API contracts:
  - create/update/read/list requests and responses
  - typed system definition payload
  - workflow-version binding metadata
  - readiness and validation result projections
- Shared query serialization helpers:
  - workflow list query params
  - system list query params

## Validation posture

- Schema layer is strict and rejects unknown transport fields.
- Shared logical references reject filesystem-style paths.
- Workflow slot contracts are validated via shared binding-contract invariants.
- Parameter specifications are normalized through domain parameter contract validation.
- Payloads reject explicit raw backend-internal keys (`graphJson`, `rawGraph`, `comfyPromptGraph`, filesystem-path keys).

## Boundary posture

- Contracts stay transport-facing and reusable.
- Persistence entities and backend adapter internals remain out of external DTOs.
- ComfyUI graph/prompt payloads remain adapter-bound and are not part of public/shared API contracts.

## Story 2.2.2 application-port coverage

- Repository ports (`IImageWorkflowDefinitionRepository`, `IImageSystemDefinitionRepository`) now define create/read/update/list/archive seams with:
  - workspace scope as a required query boundary,
  - optional owner visibility filters,
  - system sharing-policy filters,
  - version-aware workflow retrieval (`ImageWorkflowVersionSelector`),
  - workflow backend translation-reference lookup for later orchestration/adapter mapping.
- Service ports now define reusable application seams for:
  - authorization consultation (`IImageWorkflowSystemAuthorizationPort`),
  - workflow/system validation (`IImageWorkflowDefinitionValidationService`, `IImageSystemDefinitionValidationService`),
  - workflow/system compatibility evaluation (`IImageWorkflowSystemCompatibilityService`),
  - policy-aware version resolution (`IImageWorkflowVersionResolutionService`).
- Aggregate dependency wiring is captured in `ImageWorkflowSystemDefinitionPorts` so use cases can depend on one clean application boundary without SQLite/API/Comfy transport coupling.

## Story 2.2.3 workflow create/update use-case coverage

- `CreateImageWorkflowDefinitionUseCase` and `UpdateImageWorkflowDefinitionUseCase` now provide application-level authoring flows for image workflow definitions.
- Use-case boundary checks include:
  - workspace-scope enforcement (`request.workspaceId` must match workflow ownership workspace),
  - authorization consultation (`image-workflow.create`, `image-workflow.update`),
  - lifecycle transition enforcement for update operations,
  - binding-contract verification (required `source-image` slot posture and slot cardinality shape),
  - completeness enforcement (required bindings and translation seams),
  - application validation service enforcement (error-severity issues reject mutation).
- Successful mutations return stable authoring result objects with:
  - authoritative workflow identity and persisted record,
  - mutation metadata (`changed`, replay marker, operation key, timestamp),
  - readiness summary (`definition-ready` posture + completeness diagnostics),
  - validation summary from application validators,
  - structural metadata summary (input/parameter/output/binding/translation counts).

This keeps workflow authoring/editing independent of UI surfaces and backend execution graph adapters while preserving a controller-safe response shape for API routes.

## Story 2.2.4 image-system create/update use-case coverage

- `CreateImageSystemDefinitionUseCase` and `UpdateImageSystemDefinitionUseCase` now provide application-level authoring flows for image system definitions.
- Use-case boundary checks include:
  - workspace-scope enforcement (`request.workspaceId` must match system ownership workspace),
  - authorization consultation (`image-system.create`, `image-system.update`),
  - authoritative workflow-version binding checks (`workflowId`, `workflowLineageId`, `workflowVersionTag`, `workflowRevision`),
  - strict system/workflow compatibility checks before persistence,
  - required binding compatibility checks (required input/parameter/output ids declared by the bound workflow),
  - application validation service enforcement (error-severity issues reject mutation).
- Workflow rebind on system update uses a safe default posture:
  - lifecycle resets to `draft`,
  - runtime status resets to `disabled`,
  - callers receive fresh readiness diagnostics to guide studio-side reconfiguration.
- Successful mutations return stable authoring result objects with:
  - authoritative system identity and persisted record,
  - mutation metadata (`changed`, replay marker, operation key, timestamp),
  - readiness summary (`configuration-incomplete`, `configuration-ready`, `configuration-runnable`),
  - validation summary from application validators,
  - compatibility outcome and issues,
  - system structure summary (workflow binding metadata, required counts, configured counts).

This keeps system definition authoring/editing reusable across UI surfaces while enforcing tenancy, authorization, workflow compatibility, and readiness seams before run-submission paths.

## Story 2.2.5 query/list use-case coverage

- `GetImageWorkflowDefinitionUseCase` and `GetImageSystemDefinitionUseCase` now provide authoritative get-by-id read paths with:
  - workspace boundary enforcement,
  - resource read authorization (`image-workflow.read`, `image-system.read`),
  - typed readiness + structure metadata projections suitable for detail/edit/reopen surfaces.
- `ListImageWorkflowDefinitionsUseCase` and `ListImageSystemDefinitionsUseCase` now provide authoritative list/query paths with:
  - list authorization checks (`image-workflow.list`, `image-system.list`),
  - per-item read authorization filtering for mixed-visibility result sets,
  - workspace/owner/visibility/status/operation/version-aware filtering support,
  - bounded pagination and optional metadata search matching.
- Query contracts define DTO-ready list/detail shapes so Studio picker/editor/reopen flows can consume authoritative metadata directly (not local studio cache assumptions).

This keeps discovery and reopen behavior inside clean application boundaries while preserving tenancy and authorization posture.

Intended consumers:
- authoritative server application use cases for workflow/system definition create/update/publish/read/list/archive flows,
- workflow-to-system compatibility and publish/readiness orchestration services,
- future translation and execution-preparation services that need version-pinned workflow translation references.

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
