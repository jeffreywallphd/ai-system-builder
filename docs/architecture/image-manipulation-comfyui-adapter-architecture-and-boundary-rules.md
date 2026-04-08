# Image Manipulation ComfyUI Adapter Architecture and Boundary Rules

This note documents Story 3.1.5 for Feature 3 / Epic 3.1:
- architecture and boundary rules for the ComfyUI execution adapter and translation layer
- allowed dependency direction across domain, application, and infrastructure seams
- normalized status/error and output-collection posture for later run orchestration work

## Purpose

Define the production boundary where authoritative AI Loom workflow/system definitions are translated into backend-executable requests without making ComfyUI payloads the product source of truth.

This note is intentionally narrow and builds on existing Feature 2 and early Feature 3 contracts rather than restating broad platform architecture.

## Authoritative source of truth

The product source of truth for image manipulation execution remains:

1. typed workflow definitions (`ImageWorkflowDefinition`)
2. typed runnable system definitions (`ImageSystemDefinition`)
3. typed execution/translation/status/output contracts in application ports

ComfyUI request DTOs, queue/history payloads, and file handles are derived transport artifacts. They are not authoritative product records.

## Canonical seams and contracts

Application ports and contracts (authoritative boundary):
- `src/application/image-workflows/ports/ImageManipulationExecutionPorts.ts`
- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`

Comfy adapter seams (infrastructure implementation):
- `src/application/execution/comfyui/ComfyAdapterContract.ts`
- `src/application/execution/comfyui/ComfyExecutionService.ts`
- `src/infrastructure/comfyui/execution/mappers/ComfyExecutionRequestMapper.ts`
- `src/infrastructure/comfyui/execution/mappers/ComfyExecutionResultMapper.ts`
- `src/infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts`
- `src/infrastructure/comfyui/execution/ComfyQueueClient.ts`

## Translation boundary rule

Translation converts authoritative workflow/system data into an internal backend execution payload:

- input: workflow/system identity, slot bindings, parameter mappings, output expectations, capability requirements
- output: backend-facing payload + translation diagnostics

Translation is one-way derivation at dispatch time. Backend payloads are never written back as replacements for workflow/system definitions.

## Layer responsibilities and forbidden shortcuts

Domain and application layers may:
- define workflow/system models, execution ports, translation/status/output contracts
- validate completeness/readiness before dispatch
- consume normalized status/error/output snapshots

Domain and application layers must not:
- import ComfyUI transport DTO types
- parse Comfy queue/history payloads directly
- depend on backend file paths, local `file://` URIs, or provider status strings

Infrastructure adapter layers may:
- map internal execution payloads to Comfy request payloads
- perform transport calls and polling
- normalize provider status/error/output shapes back into application contracts

UI and transport surfaces must:
- invoke application use cases/ports only
- avoid direct UI-to-Comfy calls and avoid provider-owned status interpretation logic

## Normalized status and error posture

The canonical state model is backend-neutral:
- `queued`, `preparing`, `running`, `completed`, `failed`, `cancelled`

Error posture is backend-neutral and structured:
- stable error `code`
- canonical `category`
- safe summary/user message
- retryability and partial-progress/output flags
- optional diagnostics payload for internal troubleshooting

Comfy-specific reasons, HTTP codes, queue-state terms, or history details remain infrastructure diagnostics and must not replace canonical categories/states.

## Output collection posture

Output discovery and collection are contract-first:
- discovered outputs carry ordered descriptors, role metadata, media metadata, and temporary backend references
- temporary backend references are explicitly separate from persisted logical assets
- collected execution records attach persistence outcomes without making backend object handles product identity

This preserves workspace-safe logical asset ownership while allowing infrastructure adapters to retrieve temporary backend output artifacts.

## Extension guidance for later stories

Future run orchestration and node-management stories should extend behavior by:
- adding provider-side translators/mappers behind existing application contracts
- extending capability and diagnostics metadata without redefining canonical state/error/output semantics
- keeping transport/provider evolution isolated to infrastructure adapters

Do not introduce new execution paths that bypass application execution ports or write Comfy payload structures into workflow/system domain records.

## Related architecture notes

Feature 1 workspace/asset baselines:
- `docs/architecture/workspace-foundation.md`
- `docs/architecture/shared-asset-contracts.md`
- `docs/architecture/storage-access-semantics.md`

Feature 2 authoritative workflow/system baselines:
- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-system-api-contracts.md`

Feature 3 contract baselines:
- `docs/architecture/image-manipulation-execution-application-ports.md`
- `docs/architecture/image-manipulation-translation-contracts.md`
- `docs/architecture/image-manipulation-execution-status-contracts.md`
- `docs/architecture/image-manipulation-output-discovery-and-collection-contracts.md`
- `docs/architecture/image-manipulation-comfyui-template-translation-mappings.md`

Comfy infrastructure audit baseline:
- `docs/architecture/comfyui-adapter-audit.md`
