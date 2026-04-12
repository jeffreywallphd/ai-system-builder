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
- `SystemRuntimeObservability` (`SystemRuntimeBackendApi` start/start-async events)
- `ComfyUiExecutionObservability`
- `SqliteRunCollectedResultPersistenceAdapter` (`IPersistenceDiagnosticsLogger` events)
- `ServerManagedLocalStorageObjectAdapter` (`storage.local.write.succeeded|failed` diagnostics)

## Required behavior
- Emit structured events with `slice`, `correlation`, and `resilience` on degraded/failure/retry/recovery paths.
- Keep diagnostics best-effort and non-blocking.
- Use existing redaction sanitizers before logs leave process boundaries.
- Keep user-facing errors contract-safe and infrastructure diagnostics separate.

## Unsafe content policy
Never log raw:
- prompts or backend payload fragments,
- storage object handles in transport/user-facing payloads,
- secrets/tokens/credentials/session artifacts,
- internal credential-bearing backend responses.

Exception for operator-only local managed-storage diagnostics:
- `ServerManagedLocalStorageObjectAdapter` emits resolved `absolutePath` in structured write diagnostics to make on-disk upload troubleshooting deterministic.

## Upload file location formula (managed filesystem)
- `<managedStorageRootPath>/workspaces/<workspace-safe-segment>/storage/<storage-safe-segment>/objects/<objectKey>`
- `managedStorageRootPath` defaults to `<server-database-directory>/runtime-assets/managed-storage`.
- Image-asset object keys typically look like `workspaces/<workspaceId>/image-assets/<assetId>/<area>/<partition>/<filename>`.

## Extension checklist
- Use shared diagnostics helper.
- Keep correlation IDs end-to-end across API -> run -> execution -> result/preview persistence.
- Add tests for traceability and redaction.
- Update this doc and `docs/architecture/README*.md` if new image-slice observability surfaces are added.
