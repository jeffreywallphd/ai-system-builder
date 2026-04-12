# Image Workflow/System Persistence and Repositories

This note documents Story 2.3.5 for Feature 2 / Epic 2.3: durable authoritative persistence for image workflow templates (`ImageWorkflowDefinition`) and image systems (`ImageSystemDefinition`).

## Purpose

Provide production-safe persistence for workflow/system definition resources so they:

- survive process restarts,
- support authoritative reopen/list/detail flows,
- remain version-aware for later run orchestration and translation,
- stay isolated from UI-only state and raw backend graph payloads.

## Canonical implementation seams

- `src/infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceAdapter.ts`
- `src/infrastructure/persistence/image-workflows/ImageWorkflowSystemPersistenceMapper.ts`
- `src/infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceMigrations.ts`
- `src/infrastructure/persistence/image-workflows/tests/SqliteImageWorkflowSystemPersistenceAdapter.test.ts`
- `src/application/image-workflows/ports/ImageWorkflowSystemDefinitionPorts.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`

## Persistence model

The SQLite slice adds:

- `image_workflow_definition_records`
  - indexed workflow metadata for workspace/owner/visibility/operation/lifecycle/activation/version lookup,
  - canonical `definition_json` snapshot for domain rehydration,
  - persistence revision for optimistic concurrency (`expectedRevision` checks).
- `image_system_definition_records`
  - indexed system metadata for workspace/owner/visibility/sharing/workflow binding/lifecycle/runtime lookup,
  - canonical `definition_json` snapshot for domain rehydration,
  - persistence revision for optimistic concurrency.
- `image_workflow_system_mutation_replays`
  - operation-key replay safety for create/save/archive mutations across both record kinds.
- `image_workflow_system_repository_migrations`
  - version-tracked migration history.

No filesystem-path columns are introduced for workflow/system references. Contracts remain logical-reference based.

## Repository behavior

`SqliteImageWorkflowSystemPersistenceAdapter` implements both:

- `IImageWorkflowDefinitionRepository`
- `IImageSystemDefinitionRepository`

Supported behaviors:

- create/read/update/list/archive for workflow definitions,
- create/read/update/list/archive for system definitions,
- workflow version-aware resolution strategies:
  - `workflow-id`,
  - `lineage-version-tag`,
  - `lineage-revision`,
  - `latest-revision-in-lineage`,
  - `latest-published-in-lineage`,
  - `active-published-in-lineage`,
- workflow backend translation-reference retrieval,
- replay-safe mutation handling by `operationKey`,
- optimistic concurrency guard via `expectedRevision`.

## Boundary and mapping posture

Persistence mapping is isolated in `ImageWorkflowSystemPersistenceMapper`.

- Domain/application contracts are rehydrated from canonical JSON snapshots.
- SQLite row shape and query indexes remain infrastructure concerns only.
- Persistence entities are not exposed to domain/application/UI transport layers.

## Migration impact

Authoritative persistence composition now includes this domain:

- migration source id: `image-workflow-system`,
- migration table: `image_workflow_system_repository_migrations`,
- service exposure: `imageWorkflowSystemRepository` on `AuthoritativePersistentPlatformServices`.

Existing data domains are unchanged; this story adds new tables and migration hooks only.

## Validation and regression coverage

`SqliteImageWorkflowSystemPersistenceAdapter` integration tests cover:

- migration/table creation,
- durable workflow and system round-trip persistence,
- list/detail/version-resolution correctness,
- archive semantics for both resource types,
- replay-safe mutation behavior,
- optimistic concurrency rejection for stale `expectedRevision`,
- reopen behavior after adapter/database restart.
