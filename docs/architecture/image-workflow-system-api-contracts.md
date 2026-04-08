# Image Workflow and System API Contracts

This note documents Story 2.2.1 and Story 2.2.2 for Feature 2 / Epic 2.2:
- shared request/response DTO and schema validation contracts for authoritative image workflow and image system APIs
- application-layer repository/service ports for authoritative persistence, authorization-aware access, validation, compatibility checks, and version resolution
 - application-layer create/update authoring use cases for authoritative image workflow definitions (Story 2.2.3)

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
- `src/application/image-workflows/ports/ImageWorkflowSystemDefinitionPorts.ts`
- `src/application/image-workflows/CreateImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/UpdateImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/ImageWorkflowDefinitionAuthoringContracts.ts`
- `src/application/image-workflows/ImageWorkflowDefinitionAuthoringErrors.ts`
- `src/application/image-workflows/tests/ImageWorkflowSystemDefinitionPorts.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowDefinitionAuthoringUseCases.test.ts`

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

## Story 2.2.2 application-layer ports

Story 2.2.2 establishes application ports that use cases depend on for workflow/system definition persistence and policy-aware orchestration.

### Repository responsibilities

`IImageWorkflowDefinitionRepository` and `IImageSystemDefinitionRepository` define infrastructure-agnostic persistence/query seams for:

- create/read/update/list/archive lifecycle operations
- workspace-scoped retrieval (required tenancy boundary)
- optional owner, visibility, and sharing-policy filtering
- version-aware workflow retrieval through `ImageWorkflowVersionSelector`
- workflow backend translation-reference lookup for later run-translation and orchestration seams

### Service responsibilities

Dedicated service ports define policy and orchestration consultation points:

- `IImageWorkflowSystemAuthorizationPort` for resource/action authorization consultation
- `IImageWorkflowDefinitionValidationService` and `IImageSystemDefinitionValidationService` for reusable validation boundaries
- `IImageWorkflowSystemCompatibilityService` for system/workflow compatibility checks
- `IImageWorkflowVersionResolutionService` for policy-aware version selection and resolution outcomes

### Intended consumers

These ports are intended for application use cases in authoritative server services that own platform truth for image workflow/system definitions, including:

- workflow/system create/update/read/list/archive use cases
- publish/readiness and compatibility orchestration paths
- future translation/execution preparation paths that require version-pinned workflow translation metadata

The port layer intentionally excludes SQLite table details, API framework/controller details, and ComfyUI transport payloads.

## Story 2.2.3 workflow authoring use cases

Story 2.2.3 introduces application-layer write use cases for image workflow definitions:

- `CreateImageWorkflowDefinitionUseCase`
- `UpdateImageWorkflowDefinitionUseCase`

These use cases enforce authoring-time guardrails before persistence:

- workspace scope consistency (requested workspace and workflow ownership workspace must match)
- authorization checks via image workflow permission actions (`image-workflow.create`, `image-workflow.update`)
- lifecycle transition policy checks during update
- slot-contract validation posture (including required `source-image` input slot constraints)
- completeness checks for required bindings and backend translation mappings
- application validation service checks with structured issue handling (error severity blocks mutation)

On success, they return stable authoring result objects designed for API/controller mapping, including:

- authoritative workflow identity and persisted definition snapshot
- mutation metadata (`changed`, replay flag, operation key, occurred timestamp)
- readiness summary with completeness diagnostics
- validation summary for UI/API projection
- structural metadata counts for inputs/parameters/outputs/bindings/translation mappings

The resulting write path remains independent of UI presentation and backend graph execution adapters.

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
