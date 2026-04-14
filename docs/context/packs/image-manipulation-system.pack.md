# Image Manipulation System Pack

## Purpose

- Focused context for image-upload, image-selection, run-lifecycle, and result-review behavior in the image manipulation studio.
- Keep source-image asset management and studio runtime interactions aligned with canonical image system contracts.

## When To Use

- Fixing or extending image upload, browse, or reuse flows in Studio Shell.
- Updating image-manipulation runtime editor interactions across `src/ui/components/studio-shell` and `src/ui/services`.
- Investigating regressions where image asset APIs and studio interaction state diverge.

## When Not To Use

- Host/bootstrap lifecycle troubleshooting (use `runtime-and-host`).
- Broad system-studio composition tasks not specific to image workflows (use `studio-and-system-composition`).
- Storage platform internals that do not affect image-studio behavior contracts.

## Invariants

- Studio UI must use authoritative image asset APIs; no direct provider/file-system shortcuts.
- Workspace-scoped tenancy is required for image asset operations.
- Transient UI state must not replace authoritative persisted image-asset truth.
- Upload, metadata fetch, and post-upload orchestration must remain contract-driven.
- Create/upload authorization for new image assets must evaluate workspace-scoped create capability (not persisted-resource owner override alone).
- Read/list and create/upload permissions remain intentionally distinct; do not infer create rights from successful listing.

## Authoritative Docs

- `docs/architecture/image-manipulation-studio-interaction-model.md`
- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/studio-handoff-contract.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/context/packs/studio-and-system-composition.pack.md`

## Authoritative Code Paths

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/components/assets/image-system/ImageUploadPanel.tsx`
- `src/ui/services/ImageAssetManagementService.ts`
- `src/ui/runtime/ImageManipulationRuntimeDatasetBindingService.ts`
- `src/ui/runtime/ImageManipulationRuntimeExecutionRequestMapper.ts`

## Anti-Patterns

- Submitting image upload requests without normalized workspace identity context.
- Treating optional session fields as valid identifiers without normalization.
- Applying persisted-resource owner override semantics to new-asset creation intents.
- Duplicating upload orchestration logic in feature-local components.
- Persisting debug-only request payload behavior as production contract.

## Related Packs

- `repository-overview`
- `architecture-core`
- `studio-and-system-composition`
- `storage-persistence-and-materialization`
