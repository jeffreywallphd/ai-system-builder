# AI Companion: Image Workflow and System API Contracts

## What this slice adds

Story 2.2.1 defines shared API DTO/schema contracts for image workflow and image system configuration flows across desktop and thin-client surfaces.

## Canonical files

- `src/shared/contracts/image-workflows/ImageWorkflowSystemApiContracts.ts`
- `src/shared/dto/image-workflows/ImageWorkflowSystemApiDtos.ts`
- `src/shared/schemas/image-workflows/ImageWorkflowSystemApiSchemaContracts.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowSystemApiContracts.test.ts`
- `src/shared/dto/image-workflows/tests/ImageWorkflowSystemApiDtos.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageWorkflowSystemApiSchemaContracts.test.ts`
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

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
