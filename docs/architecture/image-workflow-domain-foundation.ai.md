# AI Companion: Image Workflow Domain Foundation

## What this slice adds

Story 2.1.1 introduces a dedicated typed image-workflow domain model with lifecycle and completeness invariants.

## Canonical files

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/domain/image-workflows/tests/ImageWorkflowDomain.test.ts`
- `docs/architecture/image-workflow-domain-foundation.md`

## Modeled contract

`ImageWorkflowDefinition` now carries:

- workflow identity and workspace ownership scope
- title/summary/tags display metadata
- workflow category/type and image operation kind
- version lineage and semantic version tags
- lifecycle state and activation status
- typed input slots + input binding rules
- typed parameter specifications
- typed output expectations + output binding rules
- backend translation references (translator/template/mappings)
- audit timestamps and actor metadata

## Core invariants

- canonical image operation kinds are enforced
- private scope requires owner identity
- lifecycle transitions are guarded and explicit
- only published workflows can be active
- retired workflows are always inactive
- published workflows require completeness checks
- binding ids and referenced ids must be unique/resolved
- backend translation mappings must reference declared inputs/parameters/outputs
- logical references reject raw filesystem paths
- parameter defaults are type/range/enum validated

## Boundary posture

- Domain-first modeling with no UI-only or transport-only assumptions.
- No embedded ComfyUI graph structure in the domain entity.
- Backend execution details represented through typed translation seams only.
- Workflow contracts stay authoritative and reusable for later orchestration, policy checks, and storage integration.
