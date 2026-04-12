# Image Manipulation Execution Status Contracts

## Purpose
Story 3.1.3 defines a normalized backend job-status contract for image manipulation runs so orchestration, API, and UI layers can monitor execution consistently without parsing backend-specific payloads.

## Canonical contract module
- `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`

## Normalized state model
Canonical job states are:
- `queued`
- `preparing`
- `running`
- `completed`
- `failed`
- `cancelled`

These states are backend-neutral and suitable for user-grade run monitoring. Infrastructure adapters (ComfyUI first, future backends later) map provider status strings and flags into this canonical set.

## Progress and partial-execution semantics
The status contracts include a progress snapshot with:
- bounded `percent` progress,
- stage code/label/message fields,
- optional queue position and unit counters,
- optional `partialOutputCount` for partial-output situations.

This allows run monitoring surfaces to show partial progress even when a run later fails or is cancelled.

## Warning semantics
Warnings are first-class normalized records:
- machine-readable `code`,
- safe `summary` and optional `userMessage`,
- warning severity (`info` or `warning`),
- optional diagnostic payload for developers.

Warnings are non-terminal and can co-exist with running, completed, failed, or cancelled states.

## Completion summary semantics
Completion contracts provide:
- completion timestamp and optional duration,
- total output count,
- partial-output indicators,
- warning counts,
- optional user-safe summary text.

This allows later run-finalization and UI summary cards without backend history inspection.

## Failure semantics
Failures are normalized with:
- machine-readable `code`,
- canonical category (`validation`, `timeout`, `connectivity`, `output`, etc.),
- safe summary/user message,
- retryability,
- partial-progress and partial-output flags,
- optional diagnostics payload for internal troubleshooting.

This keeps user-facing messaging safe while preserving diagnostic detail for logs and support tools.

## Boundary rules
- Application and UI layers consume normalized status contracts only.
- Raw ComfyUI queue/history DTOs remain infrastructure-only.
- The contracts are extensible to additional backends by adding provider-side mapping logic, not by changing product-facing state semantics.

## ComfyUI state interpretation normalization
- Infrastructure module:
  - `src/infrastructure/execution/comfyui/ComfyUiExecutionStatusNormalizer.ts`
- Purpose:
  - map backend prompt snapshots into canonical status/progress objects for image-manipulation execution ports.
- Normalization behavior:
  - interprets ComfyUI backend states into canonical `queued | preparing | running | completed | failed | cancelled`,
  - preserves user-safe summaries in `message`/warnings,
  - records developer diagnostics in `backendDiagnostics` and failure diagnostics,
  - keeps partial-progress/partial-output context (`partialOutputCount`, `partialProgressObserved`) for later output collection/failure handling stories.
- Resilience behavior:
  - unknown backend states degrade safely to `preparing` and emit warning `backend-state-unknown`,
  - degraded backend status hints emit warning `backend-state-degraded`,
  - missing/invalid queue/progress fields are tolerated with bounded defaults and clamped percent values.

## Story 3.3.2 failure categorization and normalization
- Added shared failure normalization utility:
  - `src/application/image-workflows/ports/ImageManipulationFailureNormalization.ts`
- Canonical failure categorization now covers the primary ComfyUI execution failure modes:
  - connectivity/unreachable backend
  - translation mismatch / invalid graph binding
  - invalid request/data payloads
  - missing model dependencies
  - timeout and cancellation
  - output collection anomalies (including partial-output situations)
- `ComfyUiExecutionStatusNormalizer` now delegates terminal failure mapping to the shared utility so progress polling emits the same category/code semantics used by dispatch and output-collection paths.
- Failure payload posture remains split:
  - machine-readable: `code`, `category`, `retryable`
  - user-safe: `summary`, `userMessage`
  - developer diagnostics: sanitized `diagnostics` payload with path/token redaction

## Story 8.1.1 taxonomy foundation integration
- Shared validation/failure taxonomy now anchors execution failure categories:
  - `src/shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy.ts`
- Normalized execution failures can include `classification` metadata with:
  - canonical issue code (`im.<layer>.<kind>.<reason>`),
  - layer ownership (`execution-dispatch`, `node-availability`, `result-collection`, etc.),
  - kind (`validation` vs `operational`),
  - disposition (`retryable` vs `terminal`),
  - user-fixable/degraded and resolution actor semantics.
- This keeps execution failures compatible with run API/presenter/audit flows while preserving backend-neutral boundaries.
