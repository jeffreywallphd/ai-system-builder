# AI Companion: Storage Logical Access Resolution Service

## Purpose

Story 9.3.3 introduces a centralized logical storage resolution seam that turns logical storage references into authorized backend object-operation plans without exposing physical storage layout.

## Canonical files

- `src/application/storage/ports/StorageObjectAccessResolverPort.ts`
- `src/application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts.ts`
- `src/application/storage/use-cases/StorageLogicalAccessResolutionService.ts`
- `src/application/storage/tests/StorageLogicalAccessResolutionService.test.ts`
- `src/infrastructure/storage/StorageBackendAdapterRegistry.ts`

## What it does

- accepts logical storage instance identity (`storage-instance://...` or instance id) + operation intent
- enforces workspace-scoped storage existence checks
- maps intent to canonical policy actions (`view` or `use-for-assets`) and evaluates through `IStoragePolicyEvaluationPort`
- resolves backend object adapter through `IStorageObjectAccessResolverPort`
- returns an internal logical access plan for downstream asset/object services

## Boundary posture

- Callers interact with logical storage resources only.
- Backend adapter selection is server-owned and backend-type driven.
- No filesystem paths or physical storage topology are returned by resolution contracts.

## Why this matters

- Keeps storage access authorization centralized and reusable.
- Prevents accidental reintroduction of raw path contracts in asset upload/download flows.
- Creates a stable seam for future protected asset access APIs.
