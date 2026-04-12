# AI Companion: Persistent Platform Service Extension Guidance

## Purpose

Story 13.4.3 baseline for Feature 13 / Epic 13.4: keep authoritative persistent platform services extensible without boundary drift.

## Canonical files

- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- `src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`
- `src/infrastructure/persistence/sqlite/SqliteTransactionCoordinator.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/persistence/tests/PersistentPlatformServices.integration.test.ts`
- `docs/architecture/persistent-platform-service-extension-guidance.md`

## Extension rules

- Define aggregate/repository boundaries in src/domain/application ports first.
- Implement adapters + mappers in `src/infrastructure/persistence/<domain>/`.
- Register migration hooks in `createAuthoritativePersistenceMigrationHooks(...)`.
- Compose adapters in `createAuthoritativePersistentPlatformServices(...)`.
- Inject persistent services through authoritative startup composition only.

## When to split boundaries

Create a new aggregate boundary when write authority, tenancy ownership, lifecycle semantics, or idempotency/replay semantics diverge from an existing aggregate. Do not split boundaries for query-only changes.

## Transactions and mapper conventions

- Use shared DTO/schema contracts for cross-layer persistence records.
- Keep row/document mapping inside adapter-local mapper files.
- Use shared transaction boundary (`IPlatformTransactionManager` + `runInTransactionBoundary(...)`) for grouped multi-repository writes.

## Redaction requirements

- Use shared persistence error translation and diagnostics logging helpers.
- Sanitize diagnostics via `sanitizePersistenceDiagnostics(...)`.
- Do not log prompt text, secrets/tokens, credential material, or filesystem/database paths.

## Regression expectation

When adding a new authoritative repository boundary, extend integration coverage in `PersistentPlatformServices.integration.test.ts` with a representative end-to-end persist + reload flow.
