# AI Companion: Storage Transport Contracts

## Purpose

Story 9.1.3 adds shared storage transport DTOs + schema validation so storage create/update/list/detail flows have stable host/API/UI contracts.

## Canonical files

- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/contracts/storage/tests/StorageTransportContracts.test.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/dto/storage/tests/StorageTransportDtos.test.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`
- `src/shared/schemas/storage/tests/StorageTransportSchemaContracts.test.ts`

## What is modeled

- storage summary/detail transport shape with:
  - backend type
  - display metadata
  - lifecycle metadata
  - policy metadata (including explicit security + lifecycle hooks)
  - access permission summary
  - replication + sync metadata
- create/update/list/detail command/query DTOs and response DTOs
- internal-vs-admin-safe projection seam for sensitive storage references

## Redaction posture

- Sensitive references are never emitted in admin-safe detail payloads.
- `toStorageInstanceDetailDto(...)` projects from internal detail to admin-safe detail and emits:
  - `sensitiveRedaction.contractVersion`
  - redacted field entries with reason and strategy
- No raw filesystem path fields exist in storage transport contracts.

## Validation posture

- Strict zod schemas reject malformed/incomplete payloads.
- Key rules include:
  - replication mode/config coherence
  - policy contradiction checks for encryption/decryption posture and retention hooks
  - identifier and timestamp format checks
  - metadata label safety enforcement
  - list pagination bounds
  - strict unknown-key rejection
- create-policy parsing applies deterministic defaults for omitted security/lifecycle policy metadata fields.
- Parse helpers throw `StorageTransportSchemaValidationError` with typed issue metadata.

## Compatibility posture

- Redaction metadata is explicitly versioned (`storage-transport/v1`) for forward compatibility.
- Payload shapes are transport-ready for HTTP/IPC/UI adapters without persistence-model leakage.
