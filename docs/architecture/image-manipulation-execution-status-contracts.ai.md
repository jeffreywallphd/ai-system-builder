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
