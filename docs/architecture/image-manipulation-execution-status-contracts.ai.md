# AI Companion: Image Manipulation Execution Status Contracts

## Source of truth
- Canonical human doc: `docs/architecture/image-manipulation-execution-status-contracts.md`
- Canonical code seam: `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`

## Why this exists
- Story 3.1.3 requires backend-neutral execution status/progress/failure contracts.
- The image manipulation slice needs user-grade run monitoring without leaking ComfyUI quirks.

## What is normalized
- Job states: `queued`, `preparing`, `running`, `completed`, `failed`, `cancelled`
- Progress snapshots: percent, stage/message, queue position, unit counters, partial-output signal
- Warnings: machine-readable code + display-safe summary
- Completion summaries: output counts, partial-output indicators, warning counts
- Failures: category + code + retryability + safe summary + diagnostics
- Backend diagnostics: optional provider/raw metadata for developer troubleshooting

## Helper behavior
- `normalizeImageManipulationBackendJobState(...)` maps provider state hints/flags into canonical job states.
- `normalizeImageManipulationProgressPercent(...)` clamps numeric percent values to `0..100`.
- `isImageManipulationExecutionTerminalState(...)` identifies terminal states.

## Boundary posture
- Product/API/UI layers depend on normalized contracts.
- Provider-specific DTO shapes stay in infrastructure adapters.
- Additional execution backends can plug into the same canonical state/failure model.

## ComfyUI backend-state interpretation update
- Added concrete infrastructure normalizer:
  - `src/infrastructure/execution/comfyui/ComfyUiExecutionStatusNormalizer.ts`
- It maps ComfyUI prompt snapshots into canonical image-manipulation execution state snapshots with:
  - stable state mapping (`queued`, `preparing`, `running`, `completed`, `failed`, `cancelled`),
  - user-safe progress messaging and warnings,
  - developer-facing diagnostics separated into `backendDiagnostics` and failure diagnostics,
  - partial-progress and partial-output continuity for downstream output/failure stories.
- Unknown/degraded handling:
  - unknown raw backend state -> safe `preparing` + `backend-state-unknown` warning,
  - degraded backend hints -> `backend-state-degraded` warning with non-breaking progress semantics.

## Story 3.3.2 failure-normalization update
- Added shared failure-normalization helper:
  - `src/application/image-workflows/ports/ImageManipulationFailureNormalization.ts`
- Failure mapping now classifies backend failures into stable categories/codes for:
  - connectivity (`dispatch-connectivity-failed`, `execution-connectivity-failed`)
  - translation mismatches (`dispatch-translation-mismatch`, `execution-translation-mismatch`)
  - invalid request/data (`dispatch-invalid-request-data`, `execution-invalid-request-data`)
  - dependency/missing-model failures (`execution-missing-model-dependency`)
  - timeout/cancellation (`dispatch-timeout`/`execution-timeout`, `execution-cancelled`)
  - output anomalies (`output-collection-failed`, `output-collection-partial-anomaly`)
- `ComfyUiExecutionStatusNormalizer` now uses that shared helper so progress-polling failure normalization stays consistent with dispatch/output collection semantics.
- User-safe summaries/messages are preserved separately from developer diagnostics; diagnostics are sanitized to avoid local path/token leakage.
