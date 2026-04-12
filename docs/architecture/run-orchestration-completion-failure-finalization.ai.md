# AI Companion: Run Orchestration Terminal Finalization and Result Registration

## Story scope
Story 16.2.7 adds authoritative terminal finalization for `completed`, `failed`, and `cancelled` runs so produced results become durable platform state with clear safe/internal visibility boundaries.

## Implemented files
- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts`
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/application/runs/tests/IngestRunExecutionUpdateUseCase.test.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
- `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`
- Human doc: `docs/architecture/run-orchestration-completion-failure-finalization.md`

## Core behavior
- Terminal finalization is now explicit and reusable through `FinalizeRunExecutionOutcomeUseCase`.
- Finalization runs for:
  - execution update terminal transitions (`completed`, `failed`, `cancelled`),
  - failed terminal dispatch outcomes.
- Finalization performs:
  - assignment release normalization,
  - queue release/finalization,
  - durable result metadata registration (including output-availability and terminal-quality hints),
  - separation of safe result summary from internal diagnostics.

## Durable result model
- User-facing terminal result summary is persisted and surfaced through run reads:
  - `RunDetail.finalization`
  - `RunStatusEnvelope.finalization`
- Result input contract now supports structured output references and metrics (`RunLifecycleUpdateRequest.result`).
- Result input contract now also supports explicit terminal hint projection:
  - `outputAvailabilityHint`: `none | partial | available | degraded`
  - `terminalQualityHint`: `standard | partial | degraded`
- Durable metadata location:
  - `metadata.orchestration.finalization`

## Internal diagnostics boundary
- Internal-only terminal diagnostics are written to:
  - `metadata.executionTelemetry.finalizationInternal`
- Existing internal update channel remains:
  - `metadata.executionTelemetry.lastInternalUpdate`

## Queue/assignment release
- Queue persistence now supports terminal queue finalization (`finalizeRunQueueEntry`) and clears active claim lease fields.
- Canonical run assignment state transitions to `released` for terminal completion/failure/cancellation while preserving historical assignment node/timestamps.

## Result-persistence handoff boundary
- Finalization remains orchestration-owned and records normalized terminal summaries only.
- Future result persistence/lineage integration is intentionally routed through `IRunFinalizationResultRegistrationPort` so persistence work does not leak into transport handlers, cancellation handlers, or execution adapters.

## Read-model integration
- Run mapper now supports enriched projection helpers from persisted records:
  - `toRunDetailFromPlatformRecord(...)`
  - `toRunStatusEnvelopeFromPlatformRecord(...)`
- These helpers include finalization summary data when present.

## Tests added/updated
- Terminal completion/cancellation finalization with result linking and hints in `IngestRunExecutionUpdateUseCase` tests.
- Failed dispatch finalization assignment/queue release behavior in dispatch-result tests.
- Immediate cancellation-path finalization projection in `RequestAuthoritativeRunCancellationUseCase` tests.
- SQLite queue finalization persistence coverage.
- Transport contract/schema coverage for result payload + finalization projection parsing.
