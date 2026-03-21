# Tuning Dataset Studio

## Architecture overview

### Domain
- `domain/tuning-datasets/interfaces/ITuningDatasetStudio.ts` defines the canonical dataset task types, lifecycle statuses, example/split/validation/export contracts, repositories, policies, and services.
- `domain/tuning-datasets/TuningDatasetEntities.ts` implements explicit governed-asset entities for datasets, immutable released versions, generative QA examples, source references, lineage, annotations, validation issues, release manifests, and export records.
- `domain/tuning-datasets/TuningDatasetServices.ts` provides concrete policies/services for QA validation, duplicate detection, split assignment, privacy sanitization, source import, heuristic QA generation, release-manifest construction, statistics calculation, and canonical/QA export generation.

### Application
- `application/tuning-datasets/contracts.ts` contains explicit commands, queries, summaries, and detail DTOs for the studio workspace.
- `application/tuning-datasets/TuningDatasetStudioApplicationService.ts` declares the application-facing workflow surface for dataset lifecycle, example lifecycle, review/quality, splits, and export.
- `application/tuning-datasets/DefaultTuningDatasetStudioApplicationService.ts` orchestrates repositories and domain services for the full generative QA vertical slice.

### Infrastructure
- `infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository.ts` persists dataset metadata in browser storage.
- `infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository.ts` persists versions, examples, source documents, validations, and export artifacts in browser storage.
- Export artifacts are stored as canonical internal records whose content can be re-downloaded later.

### Runtime / API wiring
- `ui/composition/createUiDependencies.ts` wires the new repositories, domain services, application service, UI service, and store into the existing dependency composition path.
- `ui/services/TuningDatasetService.ts` is the UI-facing API adapter used by the store and the dataset workspace.
- `ui/state/TuningDatasetStore.ts` provides runtime orchestration, loading/mutation state, and view-ready data for the tabbed dataset studio.

### UI
- `ui/pages/ContextPage.tsx` is now a top-level tabbed workspace with **Context Engineering** and **Fine-Tuning Dataset** tabs.
- `ui/components/context/ContextEngineeringLibrary.tsx` preserves the prior prompt-pack experience under the Context Engineering tab.
- `ui/components/tuning-datasets/FineTuningDatasetStudio.tsx` implements the production workflow for Overview, Sources, Examples, Validation, Splits, Versions, and Exports.

## Supported dataset task types
The domain currently models these task types:
- `chat_completion`
- `instruction_response`
- `question_answering`
- `classification`
- `extraction`
- `preference`
- `tool_calling`

## Fully implemented now vs. modeled for later
### Fully implemented now
- Canonical domain modeling for all supported task types.
- Full end-to-end UI/storage/export workflow for `question_answering` / generative QA.
- Source ingestion, example generation, review/editing, validation, split assignment, version release, and export (`canonical_json`, `canonical_jsonl`, `qa_jsonl`).

### Modeled for later
- Non-QA dataset-specific generation, validation, export, and UI editors for the other task types.
- Provider-backed generative example creation beyond the included local heuristic QA generator.

## Generative QA workflow
1. Open **Context**.
2. Switch to **Fine-Tuning Dataset**.
3. Create a dataset of type **Question Answering / Generative QA**.
4. Import one or more source documents.
5. Select sources and generate QA examples.
6. Review/edit generated examples, then accept/reject/mark needs review.
7. Run validation to identify issues and duplicates.
8. Auto-assign or manually edit train/validation/test splits.
9. Release the validated version, making it immutable.
10. Export the released version as `qa_jsonl`, `canonical_json`, or `canonical_jsonl`.

## Export formats
- `canonical_json`: rich canonical bundle with dataset/version metadata, manifest, sources, and examples.
- `canonical_jsonl`: one canonical example per line for downstream processing.
- `qa_jsonl`: generative-QA oriented export with `question`, `answer`, `context`, and metadata.

## Configuration and environment notes
- No new environment variables are required for this browser-backed implementation.
- The studio currently uses local browser storage for persistence.

## Extension points
- Add task-specific example entities and validation/export services behind the existing contracts.
- Replace or augment the heuristic QA generation service with a provider-backed implementation by swapping the `DatasetGenerationService` binding in composition.
- Add alternate persistence backends by implementing `DatasetRepository` and `DatasetVersionRepository`.
