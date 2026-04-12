# AI Companion: Image Manipulation Translation Contracts

## What this slice adds

Story 3.1.2 introduces a schema-versioned translation contract seam that converts authoritative Feature 2 workflow/system definitions plus resolved bindings into backend-executable internal payloads without exposing backend DTOs as product models.

## Canonical files

- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/application/image-workflows/tests/ImageManipulationTranslationContracts.test.ts`
- `docs/architecture/image-manipulation-translation-contracts.md`

## Request contract coverage

`ImageManipulationTranslationRequest` carries:

- authoritative workflow identity/version + backend translation reference
- authoritative system identity/workflow binding + parameter baseline references
- template resolution metadata (translator/template/contract version)
- resolved slot bindings and parameter mappings
- output expectations and capability requirements
- logical references only (filesystem paths rejected)

## Result contract coverage

`ImageManipulationTranslationResult` carries:

- status (`succeeded` or `failed`)
- success payload: `ImageManipulationBackendExecutionPayload`
- structured metadata and diagnostics summary
- reusable diagnostics (`severity`, `category`, `code`, `path`, `blocking`, details)

Failure results require at least one blocking/error diagnostic to keep translation-failure handling deterministic for run/UI layers.

## Serialization and validation posture

- request/result schemas are strict and versioned (`1.0.0`)
- request/result envelope parse helpers reject unsupported schema versions
- translation integrity checks enforce:
  - template metadata alignment with authoritative workflow backend-translation metadata
  - uniqueness for slot binding ids, parameter ids, and output ids
  - metadata/payload consistency in successful result records

## Architectural boundary posture

- Feature 2 workflow/system contracts remain authoritative product truth.
- Translation contracts are an application-layer conversion seam, not a new source-of-truth model.
- Backend execution payload is explicitly separate and internal.
- ComfyUI remains infrastructure; these contracts are backend-agnostic and substitution-ready.

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/image-manipulation-execution-application-ports.md`
- `docs/architecture/comfyui-adapter-audit.md`
