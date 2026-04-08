# AI Companion: Image Manipulation Resilience Diagnostics, Correlation, and Redaction Conventions

## Why this exists
Story 8.2.5 standardizes how resilience diagnostics are emitted across the image manipulation slice so operators can trace failures and recoveries without leaking unsafe internals.

## Canonical contracts
- Shared helper: `src/infrastructure/logging/ImageManipulationSliceDiagnostics.ts`
- Slice id: `image-manipulation`
- Shared metadata:
  - `correlation` (`requestId`, `correlationId`, `workspaceId`, `runId`, `workflowId`, `systemId`, `assetId`, `resultAssetId`, `previewDerivativeId`, `nodeId`, `executionJobId`, `backendExecutionId`, `operationKey`)
  - `resilience` (`code`, `category`, `summary`, `retryable`, `degraded`, `recoveryKind`, `retryAfterMs`, `scope`, `state`)

## Where enforced now
- `RunOrchestrationObservability`
- `ImageAssetManagementObservability`
- `ComfyUiExecutionObservability`
- `SqliteRunCollectedResultPersistenceAdapter` (`IPersistenceDiagnosticsLogger` events)

## Required behavior
- Emit structured events with `slice`, `correlation`, and `resilience` on degraded/failure/retry/recovery paths.
- Keep diagnostics best-effort and non-blocking.
- Use existing redaction sanitizers before logs leave process boundaries.
- Keep user-facing errors contract-safe and infrastructure diagnostics separate.

## Unsafe content policy
Never log raw:
- prompts or backend payload fragments,
- storage filesystem paths or raw object handles,
- secrets/tokens/credentials/session artifacts,
- internal credential-bearing backend responses.

## Extension checklist
- Use shared diagnostics helper.
- Keep correlation IDs end-to-end across API -> run -> execution -> result/preview persistence.
- Add tests for traceability and redaction.
- Update this doc and `docs/architecture/README*.md` if new image-slice observability surfaces are added.
