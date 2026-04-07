# Tuning Dataset Studio

## Architecture overview

### Domain
- `src/domain/tuning-datasets/interfaces/ITuningDatasetStudio.ts` defines the canonical dataset task types, lifecycle statuses, example/split/validation/export contracts, repositories, policies, and services.
- `src/domain/tuning-datasets/TuningDatasetEntities.ts` implements explicit governed-asset entities for datasets, immutable released versions, generative QA examples, source references, lineage, annotations, validation issues, release manifests, and export records.
- `src/domain/tuning-datasets/TuningDatasetServices.ts` provides concrete policies/services for QA validation, duplicate detection, split assignment, privacy sanitization, source import, provider-backed generation fallback orchestration, release-manifest construction, statistics calculation, and canonical/QA export generation.

### Application
- `src/application/tuning-datasets/contracts.ts` contains explicit commands, queries, summaries, and detail DTOs for the studio workspace.
- `src/application/tuning-datasets/TuningDatasetStudioApplicationService.ts` declares the application-facing workflow surface for dataset lifecycle, example lifecycle, review/quality, splits, and export.
- `src/application/tuning-datasets/DefaultTuningDatasetStudioApplicationService.ts` orchestrates repositories and domain services for the full generative QA vertical slice.

### Infrastructure
- `src/infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository.ts` persists dataset metadata in browser storage or the desktop-backed durable key-value bridge when available.
- `src/infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository.ts` persists versions, examples, source documents, validations, and export artifacts in browser storage or the desktop-backed durable key-value bridge when available.
- `src/infrastructure/python/tuning-datasets/PythonRuntimeDatasetGenerationService.ts` is the provider-backed generation adapter used by the default studio composition.
- Export artifacts are stored as canonical internal records whose content can be re-downloaded later.

### Runtime / API wiring
- `src/ui/composition/createUiDependencies.ts` wires the new repositories, the Python runtime-backed generation adapter, fallback orchestration, application service, UI service, and store into the existing dependency composition path.
- `src/ui/services/TuningDatasetService.ts` is the UI-facing API adapter used by the store and the dataset workspace.
- `src/ui/state/TuningDatasetStore.ts` provides runtime orchestration, loading/mutation state, and view-ready data for the tabbed dataset studio.

### UI
- `src/ui/pages/ContextPage.tsx` is now a top-level tabbed workspace with **Context Engineering** and **Fine-Tuning Dataset** tabs.
- `src/ui/components/context/ContextEngineeringLibrary.tsx` preserves the prior prompt-pack experience under the Context Engineering tab.
- `src/ui/components/tuning-datasets/FineTuningDatasetStudio.tsx` implements the production workflow for Overview, Sources, Examples, Validation, Splits, Versions, and Exports.

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
- Provider-backed runtime generation for `question_answering` and `chat_completion`, with explicit provenance and run history in the UI.
- Source ingestion, example generation, review/editing, validation, split assignment, version release, and export (`canonical_json`, `canonical_jsonl`, `qa_jsonl`).

### Modeled for later
- Dataset-specific generation, validation, export, and UI editors for the other task types.
- Additional provider backends beyond the current Python runtime generation path.

## Provider-backed dataset workflow
1. Open **Context**.
2. Switch to **Fine-Tuning Dataset**.
3. Create a dataset of type **Question Answering / Generative QA** or **Chat Completion**.
4. Import one or more source documents.
5. Select sources and generate examples. The studio now attempts the **Python runtime provider-backed generation path first**.
6. Inspect generation batch history, provider/path provenance, and any diagnostics or fallback warnings.
7. Review/edit generated examples, then accept/reject/mark needs review.
8. Run validation to identify issues and duplicates.
9. Auto-assign or manually edit train/validation/test splits.
10. Release the validated version, making it immutable.
11. Export the released version as `qa_jsonl`, `canonical_json`, or `canonical_jsonl`.

## Export formats
- `canonical_json`: rich canonical bundle with dataset/version metadata, manifest, sources, and examples.
- `canonical_jsonl`: one canonical example per line for downstream processing.
- `qa_jsonl`: generative-QA oriented export with `question`, `answer`, `context`, and metadata.

## Configuration and environment notes
- No new environment variables are required for the current Python runtime-backed generation path.
- In browser-only fallback mode, persistence still uses browser storage. When the desktop bridge is available, the same repositories use the durable desktop-backed storage adapter instead.

## Extension points
- Add task-specific example entities and validation/export services behind the existing contracts.
- Replace or augment the browser heuristic fallback by swapping the `DatasetGenerationService` binding in composition; the default desktop/runtime path already prefers provider-backed Python runtime generation and then explicit python-runtime-local fallback.
- Add alternate persistence backends by implementing `DatasetRepository` and `DatasetVersionRepository`.

## Fallback and degraded semantics

- **Primary path**: Python runtime provider-backed generation.
- **Fallback paths**: first the explicit `python-runtime-local` generator, then the browser heuristic path if the runtime layer is unavailable.
- **Runtime unavailable**: the fallback path records a warning diagnostic describing why the provider-backed path could not be used, plus the exact path/execution kind that ultimately generated the examples.
- **Unsupported tasks**: unsupported task types are rejected explicitly instead of silently coercing them into another generation mode.
