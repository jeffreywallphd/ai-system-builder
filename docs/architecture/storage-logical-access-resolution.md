# Storage Logical Access Resolution Service

This note documents Story 9.3.3 (Feature 9 / Epic 9.3): centralized logical storage access resolution for authoritative server-side storage operations.

## Canonical artifacts

- `src/application/storage/ports/StorageObjectAccessResolverPort.ts`
- `src/application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts.ts`
- `src/application/storage/use-cases/StorageLogicalAccessResolutionService.ts`
- `src/application/storage/tests/StorageLogicalAccessResolutionService.test.ts`
- `src/infrastructure/storage/StorageBackendAdapterRegistry.ts`

## Scope and intent

- Centralize mapping from logical storage references (`storage-instance://...`) to authorized backend object-operation adapters.
- Enforce storage policy checks before object-operation services receive backend access handles.
- Keep physical storage structure hidden from callers by returning logical access plans (storage metadata + object port), not host filesystem paths.
- Provide a reusable seam for upcoming asset upload/download and preview access services.

## Resolution behavior

`StorageLogicalAccessResolutionService` accepts actor/workspace context, operation intent, and logical storage reference/id. It then:

1. Normalizes and validates logical storage identity (`storage-instance://<id>` or explicit id).
2. Loads the managed storage instance through `IStorageInstanceRepository`.
3. Enforces workspace scoping (cross-workspace access resolves as not-found).
4. Maps logical operation intent to canonical policy action (`view` or `use-for-assets`) and evaluates via `IStoragePolicyEvaluationPort`.
5. Resolves the backend object adapter through `IStorageObjectAccessResolverPort`.
6. Returns an internal logical access plan containing the authorized storage instance + backend object port for downstream services.

## Logical intent to policy mapping

- Read-oriented intents:
  - `object-exists`
  - `read-object-metadata`
  - `open-object-read-stream`
  - mapped to policy action: `view`
- Mutation-oriented intents:
  - `create-object-key`
  - `write-object`
  - `delete-object`
  - mapped to policy action: `use-for-assets`

## Why physical storage remains abstracted

- Client/API callers provide only logical storage instance references and operation intent.
- Access decisions happen before any backend adapter is returned.
- Adapter resolution is backend-type driven and server-owned; callers cannot force path targets.
- The service returns no filesystem path or backend root metadata, preserving the architecture rule that physical placement is infrastructure-private.

## Error posture

The service returns stable resolution errors for:

- invalid requests (`storage-logical-access-invalid-request`)
- storage not found or cross-workspace access (`storage-logical-access-not-found`)
- policy denial (`storage-logical-access-policy-violation`)
- backend missing object-operation support (`storage-logical-access-capability-unsupported`)
- unexpected failures (`storage-logical-access-internal`)

## Test coverage

`StorageLogicalAccessResolutionService.test.ts` verifies:

- successful logical reference resolution to authorized object access plans
- intent-to-policy-action mapping (`view` vs `use-for-assets`)
- invalid logical reference rejection
- cross-workspace/not-found rejection semantics
- policy-denied rejection
- unsupported backend object adapter rejection
