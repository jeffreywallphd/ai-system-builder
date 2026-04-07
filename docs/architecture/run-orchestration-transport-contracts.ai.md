# AI Companion: Run Orchestration Transport Contracts

## Story scope
Story 16.1.2 establishes shared run transport contracts for authoritative submission + lifecycle mutation/read flows.

## Added shared run contract homes
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - Canonical request/response contracts for run submission, detail/status reads, cancel/retry mutations, queue status reads, and lifecycle updates.
  - Canonical run summary/detail/status and lifecycle event envelope projections.
  - Mapping helpers from `CanonicalRunRecord`.
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
  - Zod-backed parsing/validation for canonical run contract payloads.
  - Legacy runtime start payload compatibility (`systemId` + `versionId`) mapped into canonical submission shape.

## Migration wiring
- `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`
  - Now explicitly treated as a compatibility facade.
  - Route catalog now derives run route paths from canonical run transport routes.
- `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts`
  - Start-run parsing now delegates to canonical run submission parser and maps back to legacy runtime start payloads for current handlers.
  - Cancel-run parsing now delegates to canonical run cancellation parser and maps back to legacy runtime cancellation DTOs.

## Compatibility posture
- Existing clients using legacy runtime start/cancel payloads remain source-compatible.
- New clients/server handlers can depend on one canonical run contract package without importing infrastructure SDK DTOs.

## Tests added
- `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`
- `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- Updated route assertions in:
  - `src/shared/contracts/runtime/tests/SystemRuntimeTransportContracts.test.ts`

## Canonical docs
- `docs/architecture/run-orchestration-transport-contracts.md`
