# Image Workflow and System API Contracts

This note documents Story 2.2.1 for Feature 2 / Epic 2.2: shared request/response DTOs and schema validation contracts for authoritative image workflow and image system APIs.

## Purpose

Define one transport-safe contract surface for workflow/system configuration so desktop and thin-client hosts converge on the same API shape.

The contract layer in this story focuses on:

- create/update/read/list flows for image workflows
- create/update/read/list flows for image systems
- reusable slot/parameter/system binding metadata exchange
- readiness and validation projections for publish/run eligibility
- explicit version and compatibility metadata

## Canonical implementation seams

- `src/shared/contracts/image-workflows/ImageWorkflowSystemApiContracts.ts`
- `src/shared/dto/image-workflows/ImageWorkflowSystemApiDtos.ts`
- `src/shared/schemas/image-workflows/ImageWorkflowSystemApiSchemaContracts.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowSystemApiContracts.test.ts`
- `src/shared/dto/image-workflows/tests/ImageWorkflowSystemApiDtos.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageWorkflowSystemApiSchemaContracts.test.ts`

## Scope and boundary rules

The API contracts are intentionally platform-authoritative and transport-safe:

- includes typed workflow definitions, system definitions, and list/detail summaries
- includes readiness and validation issue payloads for UI/API integration
- includes compatibility metadata to support desktop + thin-client convergence
- keeps workflow parameter and input/output slot semantics structural and reusable

Explicitly excluded from external contracts:

- raw ComfyUI graph/prompt/history payloads
- backend-only graph adapter internals
- filesystem path references in logical binding fields

Schema guards enforce strict payload shapes and reject unsupported internal fields and path-like binding references.

## Relationship to existing domain/shared contracts

- Reuses input/output slot and binding structures from `ImageWorkflowBindingContracts`.
- Reuses parameter value-source semantics from `ImageWorkflowParameterContracts`.
- Reuses domain parameter normalization via `ImageWorkflowParameterSpecification`.

This keeps Story 2.2.1 focused on API-facing DTO/schema contracts without collapsing domain and transport concerns into one model.

## Downstream integration guidance

Follow-on API and UI work should:

1. Consume `src/shared/contracts/image-workflows/ImageWorkflowSystemApiContracts.ts` for request/response typing.
2. Parse transport payloads through `src/shared/schemas/image-workflows/ImageWorkflowSystemApiSchemaContracts.ts`.
3. Treat DTO projections in `src/shared/dto/image-workflows/ImageWorkflowSystemApiDtos.ts` as transport mapping seams.
4. Keep persistence and backend adapter payload models separate from these shared external contracts.

## Related architecture notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
