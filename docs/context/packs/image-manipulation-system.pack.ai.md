# AI Companion: Image Manipulation System Pack

## Purpose

- Focused context for image upload and image-run interaction behavior in the image manipulation studio.
- Keep UI upload flows and image asset API usage aligned with canonical image system contracts.

## When To Use

- Fixing image upload/list/reuse regressions in the image manipulation runtime editor.
- Updating image-asset service behavior used by studio UI.
- Diagnosing mismatches between session/workspace context and image-asset requests.

## When Not To Use

- Runtime host startup work (`runtime-and-host` primary).
- Generic studio/system composition updates not centered on image workflows (`studio-and-system-composition` primary).
- Storage backend internals with no direct studio image behavior impact.

## Invariants

- Image upload and retrieval use authoritative image-asset API contracts.
- Workspace ID and actor identity must be normalized and non-empty for workspace-scoped calls.
- Studio transient edits never override authoritative persisted image asset truth.
- Upload create/content/finalize sequence stays contract-first.
- Create/upload authorization for new image assets must evaluate workspace-scoped create capability (not persisted-resource owner override alone).
- Read/list and create/upload permissions remain intentionally distinct; do not infer create rights from successful listing.

## Authoritative Docs

- `docs/architecture/image-manipulation-studio-interaction-model.ai.md`
- `docs/architecture/image-workflow-system-definition-layer.ai.md`
- `docs/architecture/image-system-domain-foundation.ai.md`
- `docs/architecture/studio-handoff-contract.ai.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/context/packs/studio-and-system-composition.pack.ai.md`

## Authoritative Code Paths

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/components/assets/image-system/ImageUploadPanel.tsx`
- `src/ui/services/ImageAssetManagementService.ts`
- `src/ui/runtime/ImageManipulationRuntimeDatasetBindingService.ts`
- `src/ui/runtime/ImageManipulationRuntimeExecutionRequestMapper.ts`

## Anti-Patterns

- Sending upload create/finalize payloads with blank workspace IDs.
- Assuming unresolved session context is safe for workspace-scoped operations.
- Applying persisted-resource owner override semantics to new-asset creation intents.
- Bypassing shared image asset service seams from UI components.
- Keeping debug request logging in production behavior paths.

## Related Packs

- `repository-overview`
- `architecture-core`
- `studio-and-system-composition`
- `storage-persistence-and-materialization`
