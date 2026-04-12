# AI Companion: Image Workflow/System Persistence and Repositories

## Why this note exists

Story 2.3.5 adds concrete authoritative persistence adapters for image workflow and image system definitions.

This closes the durability gap from Epic 2.2 ports/use-cases by backing workflow/system authoring and query flows with restart-safe SQLite storage.

## Canonical seams

- `src/infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceAdapter.ts`
- `src/infrastructure/persistence/image-workflows/ImageWorkflowSystemPersistenceMapper.ts`
- `src/infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceMigrations.ts`
- `src/infrastructure/persistence/image-workflows/tests/SqliteImageWorkflowSystemPersistenceAdapter.test.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`

## What is persisted

- Workflow definitions (`ImageWorkflowDefinition`) in `image_workflow_definition_records`.
- System definitions (`ImageSystemDefinition`) in `image_system_definition_records`.
- Mutation replay records in `image_workflow_system_mutation_replays`.
- Schema migration versions in `image_workflow_system_repository_migrations`.

The adapter persists indexable metadata columns plus canonical `definition_json` snapshots for domain rehydration.

## Behaviors implemented

- Create/read/update/list/archive for workflow definitions.
- Create/read/update/list/archive for system definitions.
- Version-aware workflow resolution for all selector strategies defined by `ImageWorkflowVersionSelector`.
- Backend translation-reference lookup for workflow resolution targets.
- Operation-key replay safety for idempotent mutation handling.
- `expectedRevision` optimistic-concurrency enforcement via persistence revision columns.

## Boundary posture

Persistence row shapes are isolated from domain/shared-contract models via mapper functions.

- Domain objects are reconstructed with domain rehydration functions.
- UI and transport layers do not receive SQLite-specific models.
- Raw backend graph payloads remain outside authoritative workflow/system persistence contracts.

## Composition impact

`AuthoritativePersistenceComposition` now registers:

- migration domain `image-workflow-system`,
- migration source `IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_MIGRATIONS`,
- repository service field `imageWorkflowSystemRepository`.

## Test coverage

Integration tests validate:

- migration/table bootstrap,
- durable workflow/system round trips,
- version-resolution and list filters,
- archive semantics,
- replay-safe mutation behavior,
- stale `expectedRevision` rejection,
- reopen/reload behavior after restart.
