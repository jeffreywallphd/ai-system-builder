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
