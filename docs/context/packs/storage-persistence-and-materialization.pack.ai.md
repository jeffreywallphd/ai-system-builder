# AI Companion: Storage, Persistence, and Materialization Pack

## Purpose

- Focused guardrails for canonical durable storage, persistence verification, and runtime materialization truth.
- Keep persistence-sensitive behavior anchored to authoritative storage contracts instead of temporary/UI-local assumptions.

## When To Use

- Changing storage lifecycle, durable persistence contracts, or storage-backed runtime feature behavior.
- Updating result materialization paths (generated results, previews, originals) tied to canonical storage truth.
- Reviewing persistence-sensitive success/failure semantics where durable write verification matters.

## When Not To Use

- Host startup sequencing work without storage model or persistence-safety impact.
- Transport-route changes that do not alter durable persistence/materialization behavior.
- UI-only presentation tasks without persistence-state coupling.

## Invariants

- Persistence-sensitive success states reflect verified durable outcomes, not optimistic in-memory assumptions.
- Canonical storage/resource identifiers stay authoritative over ad hoc filesystem path assumptions.
- Materialized runtime files and preview assets stay aligned with storage and lineage contracts.
- Degraded/partial persistence outcomes stay explicit and queryable rather than silently successful.
- Storage evolution preserves workspace ownership, lifecycle, and policy boundaries as first-class contracts.

## Authoritative Docs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md`
- `docs/architecture/storage-foundation.md`
- `docs/architecture/storage-persistence-contracts.ai.md`
- `docs/architecture/persistence-bootstrap-and-lifecycle.ai.md`
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
