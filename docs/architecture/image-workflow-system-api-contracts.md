# Image Workflow and System API Contracts

This note documents Story 2.2.1 through Story 2.2.5 for Feature 2 / Epic 2.2:
- shared request/response DTO and schema validation contracts for authoritative image workflow and image system APIs
- application-layer repository/service ports for authoritative persistence, authorization-aware access, validation, compatibility checks, and version resolution
- application-layer create/update authoring use cases for authoritative image workflow definitions (Story 2.2.3)
- application-layer create/update authoring use cases for authoritative image system definitions (Story 2.2.4)
- application-layer query/list use cases for authoritative workflow/system discovery and reopen flows (Story 2.2.5)
- reusable readiness validation services for consistent workflow/system readiness evaluation across authoring and query/list flows (Story 2.2.6)

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
- `src/application/image-workflows/ImageWorkflowSystemReadinessValidationService.ts`
- `src/application/image-workflows/tests/ImageWorkflowSystemDefinitionPorts.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowDefinitionAuthoringUseCases.test.ts`
- `src/application/image-workflows/tests/ImageSystemDefinitionAuthoringUseCases.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowSystemQueryUseCases.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowSystemReadinessValidationService.test.ts`

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

## Story 2.2.4 image-system authoring use cases

Story 2.2.4 introduces application-layer write use cases for image system definitions:

- `CreateImageSystemDefinitionUseCase`
- `UpdateImageSystemDefinitionUseCase`

These use cases enforce authoring-time guardrails before persistence:

- workspace scope consistency (requested workspace and system ownership workspace must match)
- authorization checks via image system permission actions (`image-system.create`, `image-system.update`)
- authoritative workflow-version binding checks (`workflowId`, `workflowLineageId`, `workflowVersionTag`, `workflowRevision`)
- binding-compatibility checks for required input/parameter/output ids against the resolved workflow definition
- compatibility-service checks in strict mode (incompatible outcomes block mutation)
- system validation-service checks with structured issue handling (error severity blocks mutation)

Workflow rebind behavior during system updates is explicit and safe by default:

- lifecycle is reset to `draft`
- runtime status is reset to `disabled`
- readiness diagnostics are re-evaluated and returned to guide studio reconfiguration flows

On success, system authoring returns a stable result shape that includes:

- authoritative system identity and persisted definition snapshot
- mutation metadata (`changed`, replay flag, operation key, occurred timestamp)
- readiness summary (`configuration-incomplete`, `configuration-ready`, `configuration-runnable`) with issue details
- validation summary for UI/API projection
- workflow compatibility outcome and issues
- structural metadata (workflow binding metadata plus required/configured counts)

This preserves clean architecture boundaries while making system authoring reusable by desktop and thin-client surfaces without coupling to run submission/execution internals.

## Story 2.2.5 workflow/system query use cases

Story 2.2.5 introduces authoritative read/list application use cases for workflow/system discovery and reopen behavior:

- `GetImageWorkflowDefinitionUseCase`
- `ListImageWorkflowDefinitionsUseCase`
- `GetImageSystemDefinitionUseCase`
- `ListImageSystemDefinitionsUseCase`

These use cases enforce query-time guardrails:

- required workspace and actor context normalization
- explicit authorization for list and detail actions (`image-workflow.list`, `image-workflow.read`, `image-system.list`, `image-system.read`)
- per-item authorization filtering for list results so mixed-visibility resources do not leak
- repository-driven metadata retrieval (no studio-local state assumptions)
- typed readiness/detail projections for editor/picker/reopen surfaces

List queries support workspace-scoped filters for ownership, visibility, lifecycle/runtime status, operation kinds, workflow lineage/version selectors, sharing policy, and tags, with bounded pagination and optional search matching over stable definition metadata.

This keeps discovery and reopen paths anchored to authoritative API/application metadata instead of cached studio-only assumptions.

## Story 2.2.6 readiness validation services

Story 2.2.6 introduces a reusable application service:

- `ImageWorkflowSystemReadinessValidationService`

The service centralizes readiness and validation behavior for both resources:

- workflow readiness/structure evaluation (complete vs incomplete posture),
- system readiness/structure evaluation (including runnable posture),
- aggregated authoring assessments that unify:
  - readiness issues,
  - validation issues,
  - workflow/system compatibility issues,
  - workflow-binding reference issues.

Assessment output keeps machine-readable issue codes and adds user-facing summaries/classification so API/UI layers can distinguish:

- draft
- incomplete
- valid
- runnable

Authoring use cases and query contracts now reuse this service so readiness semantics stay consistent and incomplete/invalid definitions are surfaced before later run-submission and execution orchestration layers consume the definitions.

## Downstream integration guidance

Follow-on API and UI work should:

1. Consume `src/shared/contracts/image-workflows/ImageWorkflowSystemApiContracts.ts` for request/response typing.
2. Parse transport payloads through `src/shared/schemas/image-workflows/ImageWorkflowSystemApiSchemaContracts.ts`.
3. Treat DTO projections in `src/shared/dto/image-workflows/ImageWorkflowSystemApiDtos.ts` as transport mapping seams.
4. Keep persistence and backend adapter payload models separate from these shared external contracts.

## Story 2.4.1 studio workflow picker integration

System Studio now consumes authoritative workflow metadata through studio-shell API operations instead of local template JSON assumptions:

- `StudioShellBackendApi.listImageWorkflowDefinitions(...)`
- `StudioShellBackendApi.getImageWorkflowDefinition(...)`
- bridge/service wiring:
  - `electron/main/main.ts` IPC handlers:
    - `ai-loom-desktop-studio-shell:image-workflows:list`
    - `ai-loom-desktop-studio-shell:image-workflows:get`
  - `electron/preload.ts` desktop bridge methods:
    - `studioShell.listImageWorkflowDefinitions(...)`
    - `studioShell.getImageWorkflowDefinition(...)`
  - `src/ui/services/StudioShellService.ts` methods:
    - `listImageWorkflowDefinitions(...)`
    - `getImageWorkflowDefinition(...)`
  - `src/ui/pages/StudioShellPage.tsx` extension operation wiring
  - `src/ui/components/studio-shell/SystemStudioWorkManagementPanel.tsx` picker UX and selection flow

UI behavior in this story:

- users select supported operations by logical workflow id (`workflowId`) with user-facing title/summary/rationale;
- selection state is held as stable workflow DTO + logical id and applied through `modifySystemDefinition` workflow bindings;
- workflow selection no longer depends on raw backend template payload injection in component-local config.

## Story 2.4.2 typed parameter configuration forms

System Studio now renders workflow-parameter forms from authoritative workflow definition metadata returned by `getImageWorkflowDefinition`.

Implementation seams:

- authoritative API read-model expansion in `StudioShellBackendApi`:
  - `parameterSpecifications: ImageWorkflowParameterSpecification[]`
  - `parameterDefaults: Record<string, unknown>`
- template-to-typed-parameter mapping in `StudioShellBackendApi.toImageWorkflowParameterSpecifications(...)`
  - carries value kind, required/default semantics, validation bounds, helper text, and UI control hints
- reusable UI/presenter layer:
  - `src/ui/components/studio-shell/SystemWorkflowParameterForm.tsx`
  - `src/ui/components/studio-shell/SystemWorkflowParameterFormPresenter.ts`
- system-studio integration:
  - `SystemStudioWorkManagementPanel` renders typed controls from `parameterSpecifications`
  - values are initialized from authoritative defaults plus saved runtime state
  - save path uses existing `modifySystemDefinition` seam with `runtimeStatePatch`

Validation posture:

- UI validation reuses shared contract logic (`validateImageSystemParameterSetContract`) instead of component-local rule duplication.
- Validation feedback is projected per-parameter (and global when needed) with clear user-facing messages.
- Conditional/disabled control handling is driven by parameter visibility metadata when present.

## Story 2.4.3 system save, update, and reopen flows

System Studio now persists and reopens image manipulation systems through authoritative image-system APIs instead of local-only draft duplication/open behavior.

Canonical seams for this story:

- backend API surface (`StudioShellBackendApi`):
  - `listImageSystemDefinitions(...)`
  - `getImageSystemDefinition(...)`
  - `saveImageSystemDefinition(...)`
- backend image-system use-case support:
  - `src/infrastructure/api/studio-shell/StudioImageSystemDefinitionSupport.ts`
- desktop/browser transport:
  - IPC channels in `electron/main/main.ts`
    - `ai-loom-desktop-studio-shell:image-systems:list`
    - `ai-loom-desktop-studio-shell:image-systems:get`
    - `ai-loom-desktop-studio-shell:image-systems:save`
  - bridge contracts/preload/fallback wiring in:
    - `electron/shared/DesktopContracts.ts`
    - `electron/preload.ts`
    - `src/ui/composition/BrowserStudioShellBridgeFallback.ts`
- Studio service/page wiring:
  - `src/ui/services/StudioShellService.ts`
  - `src/ui/pages/StudioShellPage.tsx`
  - `src/ui/studio-shell/StudioShellExtensions.ts`
- System Studio UX flow:
  - `src/ui/components/studio-shell/SystemStudioWorkManagementPanel.tsx`

Lifecycle behavior now exposed to users:

- `Save as new` creates a new authoritative image-system definition from current draft workflow/parameter state.
- `Update saved` mutates the selected authoritative image-system definition.
- `Reopen saved` hydrates workflow selection and parameter baseline from authoritative system detail into active draft state.

Source-of-truth posture for this story:

- saved system identity (`imageSystemDefinitionId`), selected workflow binding, and parameter baseline are synchronized via authoritative API responses and persisted draft runtime state.
- System Studio avoids keeping a separate conflicting local truth for saved system configuration.

This keeps System Studio ready for later run-submission integration because saved/reopened systems carry workflow version binding, readiness summary, and parameter baseline from authoritative contracts.

## Story 2.4.4 readiness and validation feedback in studio

System Studio now renders structured readiness feedback from authoritative image-system API read models so save/reopen/edit flows expose the same blocking and advisory posture.

Canonical seams for this story:

- backend read-model projection in `StudioShellBackendApi`:
  - `StudioImageSystemReadinessReadModel`
  - `StudioImageSystemReadinessIssueReadModel`
  - `StudioImageSystemDefinitionSummaryReadModel.readiness`
  - `StudioImageSystemDefinitionReadModel.readiness`
- UI readiness presentation:
  - `src/ui/components/studio-shell/SystemWorkflowSelectionPresenter.ts`
  - `src/ui/components/studio-shell/SystemStudioWorkManagementPanel.tsx`
  - `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`

Readiness UX behavior:

- blocking issues and advisories are shown in separate sections.
- readiness badges are consistent (`Blocked`, `Advisory`, `Ready`, `Runnable`) across saved-system selection and recent-system reopen surfaces.
- issue rows include field-aware labels derived from authoritative issue paths (for example edit type binding, operation settings, output destination), keeping fix guidance specific.
- save/update/reopen status messaging reflects returned authoritative readiness counts rather than UI-local heuristics.

Source-of-truth posture:

- readiness state, summary, and issue lists come from image-system query/save API responses.
- the studio does not infer readiness from ad hoc component-only rules for system definition persistence and reopen flows.
- invalid/incomplete definitions remain blocked by application-layer authoring validation before persistence, and studio messaging now surfaces this posture explicitly.

## Related architecture notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
