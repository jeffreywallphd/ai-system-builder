# Persistent Platform Service Extension Guidance

This note documents Story 13.4.3 (Feature 13 / Epic 13.4): integration-test expectations and contributor rules for extending authoritative persistent platform services.

## Canonical implementation seams

- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- `src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`
- `src/infrastructure/persistence/sqlite/SqliteTransactionCoordinator.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/persistence/tests/PersistentPlatformServices.integration.test.ts`

## What must remain true

- Authoritative writes go through composed persistent platform services, not local cache or UI state.
- Aggregate boundaries are defined in domain/application contracts first, then implemented by infrastructure adapters.
- Repository adapters own migration execution, mapper translation, replay handling, and persistence conflict translation.
- Logs and diagnostics remain redaction-safe for secrets, prompt content, tokens, and filesystem/database paths.

## How to add a new repository

1. Define or extend the boundary contract in `src/domain/*` and `src/application/*/ports`.
2. Add shared persistence DTO/schema contracts under `src/shared/dto/*` and `src/shared/schemas/*` if a new record shape crosses layers.
3. Add infrastructure mapper + SQLite adapter under `src/infrastructure/persistence/<domain>/`.
4. Add domain migration entries and include the domain source in `createAuthoritativePersistenceMigrationHooks(...)`.
5. Add the adapter to `AuthoritativePersistentPlatformServices` and `createAuthoritativePersistentPlatformServices(...)`.
6. Inject the composed services only through authoritative host startup (`AuthoritativeServerCompositionRoot` -> `IdentityServerHost`).

## When to introduce a new aggregate boundary

Create a new boundary when at least one is true:

- lifecycle transitions are owned by a different domain authority than existing aggregates
- tenancy/trust ownership changes (`platform`, `workspace`, `user`, `node`, `mixed`)
- replay/idempotency semantics or consistency rules are materially different
- read/query projections can remain shared, but write authority cannot

Do not create a new boundary when only new query filters or projection fields are needed.

## Mapper and transaction wiring rules

- Keep mapper code adapter-local and contract-driven. Do not leak SQL row shape above infrastructure.
- Parse shared DTO/schema contracts before returning records to application/domain layers.
- For multi-record mutations in one use case, wire `IPlatformTransactionManager` and run through `runInTransactionBoundary(...)`.
- Repositories participating in grouped writes must expose `runInTransaction(...)` through the shared coordinator, not custom transaction APIs.

## Redaction and diagnostics rules

- Use `SafeSqliteRepositoryBase` failure translation and `PersistenceDiagnosticsLogger` defaults.
- Sanitize diagnostics with `sanitizePersistenceDiagnostics(...)` from `src/infrastructure/logging/PersistenceRedaction.ts`.
- Never log raw secret payloads, prompt text, auth tokens, credential material, or host/database absolute paths.
- Keep API-facing errors stable and non-leaky through `PersistenceFailure` codes.

## Required regression coverage when extending the foundation

- Adapter/domain slice tests for the new repository and mapper.
- Composition tests when startup wiring or service registration changes.
- Update `src/infrastructure/persistence/tests/PersistentPlatformServices.integration.test.ts` with at least one representative flow touching the new authoritative boundary.
- Keep this guide and `docs/architecture/persistent-platform-domain-boundaries.md` aligned with implemented seams.
