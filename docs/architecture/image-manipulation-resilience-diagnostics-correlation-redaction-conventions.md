# Image Manipulation Resilience Diagnostics, Correlation, and Redaction Conventions

## Story scope
- Feature 8 / Epic 8.2 / Story 8.2.5.
- Scope: production-grade resilience diagnostics and request-to-run/result correlation for the image manipulation vertical slice.
- Applies to assets, run orchestration, execution adapters, collected-result persistence, and preview provisioning pathways.

## Intent
- Keep diagnostics operationally useful across the full slice without leaking unsafe values.
- Preserve architecture boundaries between infrastructure diagnostics and user-facing messaging.
- Use shared infrastructure logging contracts instead of ad hoc logging.

## Canonical shared diagnostic vocabulary
- Slice identifier: `image-manipulation`.
- Correlation model: `ImageManipulationSliceCorrelation` in `src/infrastructure/logging/ImageManipulationSliceDiagnostics.ts`.
- Resilience diagnostic model: `ImageManipulationSliceResilienceDiagnostic` in `src/infrastructure/logging/ImageManipulationSliceDiagnostics.ts`.

Required correlation dimensions are optional per event but should be populated when known:
- `requestId`, `correlationId`, `workspaceId`, `runId`, `workflowId`, `systemId`
- `assetId`, `resultAssetId`, `previewDerivativeId`
- `nodeId`, `executionJobId`, `backendExecutionId`, `operationKey`

## Event emission posture
The image slice now emits structured resilience diagnostics across these services:
- Run API observability via `RunOrchestrationObservability`.
- Image asset API observability via `ImageAssetManagementObservability`.
- Comfy execution observability via `ComfyUiExecutionObservability`.
- Result/preview persistence diagnostics via `SqliteRunCollectedResultPersistenceAdapter` and `IPersistenceDiagnosticsLogger`.

Each service follows the same baseline:
- Emit `slice` and normalized `correlation` metadata.
- Attach explicit `resilience` diagnostics on failures, degraded states, retryable incidents, and recovery/fallback paths.
- Keep business-level diagnostics in structured fields (`code`, `category`, `summary`, `retryable`, `recoveryKind`, `scope`, `state`) instead of free-form strings.

## Redaction and safety conventions
- Diagnostic payloads must pass through repository-standard sanitizers (`PersistenceRedaction`, run/image redaction adapters, and execution redaction adapters).
- Never log raw prompts, storage paths, bearer/session tokens, secrets, internal credential material, or backend payload fragments.
- Error summaries included in diagnostics must be sanitized and bounded; raw exception payloads must not be emitted directly.
- User-facing API error contracts remain separate from infrastructure diagnostic detail.

## Operational troubleshooting guidance
For degraded/failure triage across the slice:
1. Start with `correlationId` or `operationKey` from the ingress API event.
2. Follow run and execution events by `runId` + `executionJobId`.
3. Follow result persistence and preview events by `resultAssetId` + `previewDerivativeId`.
4. Use `resilience.code`, `resilience.scope`, and `resilience.recoveryKind` to identify retry vs terminal behavior.

## Guardrails for extensions
When adding new image-slice infrastructure services:
- Reuse `ImageManipulationSliceDiagnostics` helpers for correlation/resilience normalization.
- Emit diagnostics through repository-standard logger interfaces.
- Add or update tests that assert both traceability (`slice`/`correlation`/`resilience`) and redaction safety.
- Keep infrastructure-only detail out of presenter and user message surfaces.
