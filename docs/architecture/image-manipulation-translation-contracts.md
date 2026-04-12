# Image Manipulation Translation Contracts

This note documents Story 3.1.2 for Feature 3 / Epic 3.1:
- translation request and response contracts that bridge authoritative image workflow/system definitions to backend-executable payloads
- structured template resolution, slot binding, parameter mapping, output expectation, and capability requirement semantics
- reusable translation diagnostics and schema-versioned serialization envelopes

## Purpose

Define one application contract seam for workflow-to-backend conversion so:

- Feature 2 workflow/system models remain the product source of truth
- translation produces a separate internal execution payload
- backend adapters (ComfyUI first, future providers later) can remain replaceable

## Canonical implementation seam

- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/application/image-workflows/tests/ImageManipulationTranslationContracts.test.ts`

## Contract model

1. Translation request (`ImageManipulationTranslationRequest`)
- carries authoritative workflow identity/version + backend translation reference
- carries authoritative system identity/workflow binding + parameter baseline references
- carries template resolution metadata (translator id, template id/version, adapter family hints)
- carries resolved slot bindings, parameter mappings, output expectations, capability requirements
- carries only logical references for assets/targets (no raw filesystem path contracts)

2. Translation result (`ImageManipulationTranslationResult`)
- explicit status: `succeeded` or `failed`
- on success includes a backend-facing internal payload (`ImageManipulationBackendExecutionPayload`)
- includes translation result metadata and diagnostics summary
- includes structured diagnostics for both success and failure paths

3. Serialization envelopes
- `ImageManipulationTranslationRequestEnvelope`
- `ImageManipulationTranslationResultEnvelope`
- explicit schema version: `1.0.0`
- parse helpers reject unsupported schema versions

## Diagnostics posture

Diagnostics are structured for reuse by run orchestration and UI layers:

- severity (`info`, `warning`, `error`)
- category (`template-resolution`, `slot-binding`, `parameter-mapping`, `output-mapping`, etc.)
- machine code, path, message, blocking flag, optional details

Failure results must include at least one blocking or error-level diagnostic so upstream layers can classify translation failures deterministically.

## Boundary rules

- Authoritative DTOs and backend payloads are distinct contract shapes.
- Translation request models what is known from Feature 2 definitions plus resolved runtime bindings.
- Translation result models what can be executed by backend adapters.
- ComfyUI-specific transport/request/history DTOs stay outside these application contracts.

## Relationship to adjacent architecture notes

- Feature 2 authoritative definitions:
  - `docs/architecture/image-workflow-system-definition-layer.md`
  - `docs/architecture/image-workflow-system-api-contracts.md`
- Feature 3 execution ports:
  - `docs/architecture/image-manipulation-execution-application-ports.md`
- ComfyUI adapter boundary posture:
  - `docs/architecture/comfyui-adapter-audit.md`
