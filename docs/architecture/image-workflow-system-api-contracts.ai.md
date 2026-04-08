# AI Companion: Image Workflow and System API Contracts

## What this slice adds

Story 2.2.1 defines shared API DTO/schema contracts for image workflow and image system configuration flows across desktop and thin-client surfaces.
Story 2.2.2 adds application-layer repository/service ports for authoritative workflow/system persistence and policy-aware resolution.

## Canonical files

- `src/shared/contracts/image-workflows/ImageWorkflowSystemApiContracts.ts`
- `src/shared/dto/image-workflows/ImageWorkflowSystemApiDtos.ts`
- `src/shared/schemas/image-workflows/ImageWorkflowSystemApiSchemaContracts.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowSystemApiContracts.test.ts`
- `src/shared/dto/image-workflows/tests/ImageWorkflowSystemApiDtos.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageWorkflowSystemApiSchemaContracts.test.ts`
- `src/application/image-workflows/ports/ImageWorkflowSystemDefinitionPorts.ts`
- `src/application/image-workflows/tests/ImageWorkflowSystemDefinitionPorts.test.ts`
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
