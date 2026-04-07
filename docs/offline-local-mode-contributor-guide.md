# Offline Local-Mode Contributor Guide

## Purpose

Provide a durable implementation workflow for extending offline/local-mode behavior without breaking authoritative control-plane boundaries.

## Canonical docs for this area

- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/architecture/offline-sync-shared-contracts.md`
- `docs/architecture/host-runtime-composition-boundaries.md`
- `docs/architecture/desktop-host-assembly.md`

## Canonical implementation seams

- domain boundary catalog and policy evaluators:
  - `src/domain/platform/OfflineLocalModeBoundaries.ts`
- application classification and reconnect policy:
  - `src/application/common/OfflineResourceClassificationPolicy.ts`
  - `src/application/common/OfflineLocalModeResynchronization.ts`
- desktop host local-mode binding:
  - `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- shared offline contracts and schema parsers:
  - `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
  - `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
  - `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`

## Required extension sequence

1. Update shared contracts and schema validation first when any payload shape, status transition, conflict marker, or registration envelope changes.
2. Update domain offline catalog and policy semantics second:
   - register resource class or execution class,
   - set authority scope and storage bucket,
   - define capability matrix and eligibility metadata.
3. Update application classification/resynchronization behavior third:
   - keep reconnect decision rules explicit and bounded,
   - preserve visible divergence handling.
4. Update desktop profile bindings fourth:
   - keep desktop runtime as `control-plane-client`,
   - enforce allowed resource and execution classes through profile gates.
5. Update adapters/UI surfaces last to consume new canonical contracts; do not invent ad hoc offline object shapes.

## Adding a new offline resource class

Required:
- add the class constant and boundary entry in `OfflineLocalModeBoundaries.ts`;
- include behavior class, authority scope, storage bucket, capability matrix, and eligibility metadata;
- ensure unsupported classes still fail closed;
- include reconnect policy and prohibited-pattern mapping;
- add policy matrix and evaluator test coverage.

## Extending local draft semantics

Required:
- preserve explicit `baseAuthoritativeRevision` and `authoritativeSnapshotRevision`;
- preserve explicit sync-status transitions;
- keep local edits resetting draft sync status to `local-only`;
- keep queued linkage explicit via `queuedMutationId`.

## Extending pending operation semantics

Required:
- use queued envelopes with rooted replay descriptor (`method`, `path`, `idempotencyKey`, `payload`);
- include `divergenceDisclosureToken`;
- preserve no-preclaim rule: queued operations cannot be pre-marked globally applied;
- keep operation status transitions explicit (`queued-pending-sync`, `sync-conflict`, `sync-rejected`, `sync-applied`).

## Extending reconnect conflict handling

Required:
- classify non-apply outcomes with canonical conflict class;
- keep decision rules explicit and testable;
- keep user/admin attention requirements explicit;
- preserve `assertResynchronizationPlanPreventsSilentGlobalDivergence(...)` invariants.

## What must remain server-authoritative

- replay authorization and final apply/reject decisions;
- global shared-resource lifecycle writes;
- secret plaintext materialization;
- authoritative run history and orchestration lifecycle truth;
- conflict finalization for reconnect replay.

## Prohibited patterns

- treating offline cache or local draft as global authority;
- silently auto-merging conflicts or rejections;
- bypassing canonical domain/application seams from UI or transport handlers;
- storing/transporting offline state via ad hoc contract shapes;
- bypassing desktop host role checks to grant authoritative posture;
- blending local execution history into authoritative history without explicit registration outcome.

## Required tests and docs updates

At minimum, update:
- `src/domain/platform/tests/OfflineLocalModeBoundaries.test.ts`
- `src/application/common/tests/OfflineResourceClassificationPolicy.test.ts`
- `src/application/common/tests/OfflineLocalModeResynchronization.test.ts`
- `src/hosts/desktop/tests/DesktopOfflineLocalModeProfile.test.ts`
- `src/shared/contracts/runtime/tests/OfflineSynchronizationContracts.test.ts`
- `src/shared/dto/runtime/tests/OfflineSynchronizationDtos.test.ts`
- `src/shared/schemas/runtime/tests/OfflineSynchronizationSchemaContracts.test.ts`

When architecture behavior changes, update both:
- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/architecture/offline-local-mode-authority-boundaries.ai.md`

When contributor guidance changes, update both:
- `docs/offline-local-mode-contributor-guide.md`
- `docs/offline-local-mode-contributor-guide.ai.md`
