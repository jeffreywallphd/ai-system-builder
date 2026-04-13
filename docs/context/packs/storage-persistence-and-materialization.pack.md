# Storage, Persistence, and Materialization Pack

## Purpose

- Provide focused guardrails for canonical durable storage, persistence verification, and runtime materialization truth.
- Keep persistence-sensitive behavior anchored to authoritative storage contracts instead of temporary or UI-local assumptions.

## When To Use

- Changing storage lifecycle, durable persistence contracts, or storage-backed runtime feature behavior.
- Updating result materialization paths (generated results, previews, originals) tied to canonical storage truth.
- Reviewing persistence-sensitive success/failure UX semantics where durable write verification matters.

## When Not To Use

- Host startup sequencing work with no storage model or persistence-safety impact.
- Pure transport-route changes that do not alter durable persistence or materialization behavior.
- UI-only presentation work with no persistence-state coupling.

## Invariants

- Durable/persistence-sensitive success states must reflect verified persistence outcomes, not optimistic in-memory assumptions.
- Canonical storage/resource identifiers remain authoritative over ad hoc filesystem path assumptions.
- Materialized runtime files and preview assets must remain aligned with authoritative storage and lineage contracts.
- Degraded or partial persistence outcomes must remain explicit and queryable rather than silently treated as success.
- Storage evolution must preserve workspace ownership, lifecycle, and policy boundaries as first-class contracts.

## Authoritative Docs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.md`
- `docs/architecture/storage-foundation.md`
- `docs/architecture/storage-persistence-contracts.md`
- `docs/architecture/persistence-bootstrap-and-lifecycle.md`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`

## Authoritative Code Paths

- `src/domain/storage/StorageDomain.ts`
- `src/application/storage/ports/IStorageInstanceRepository.ts`
- `src/infrastructure/persistence/storage/SqliteStorageInstancePersistenceAdapter.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- `src/infrastructure/persistence/generated-results/SqliteGeneratedResultPersistenceAdapter.ts`
- `src/infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter.ts`

## Anti-Patterns

- Reporting persistence success before durable storage write confirmation.
- Treating backend-local filesystem paths as canonical storage identity.
- Skipping lineage/storage linkage updates when materialization flow changes.
- Collapsing partial/failed materialization into generic success responses.

## Related Packs

- `repository-overview`
- `architecture-core`
- `runtime-and-host`
- `transport-and-runtime-availability`
- `observability-and-readiness`
