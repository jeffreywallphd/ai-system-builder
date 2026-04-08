# Image Run Orchestration Application Ports

This note documents Story 4.1.3 (Feature 4 / Epic 4.1): application-layer ports for authoritative image-run persistence and orchestration.

## Purpose

Define one backend-neutral application seam for image-run orchestration so use cases can persist run metadata, resolve readiness, enqueue work, dispatch execution, ingest normalized updates, request cancellation, and hand off outputs without coupling to queue infrastructure or execution adapter internals.

## Canonical implementation seam

- `src/application/image-workflows/ports/ImageRunOrchestrationPorts.ts`
- `src/application/image-workflows/ports/index.ts`
- `src/application/image-workflows/tests/ImageRunOrchestrationPorts.test.ts`

## Port coverage

1. Run persistence repository
- `IImageRunRepository`
- Create/read/update/list authoritative `ImageRunRecord` metadata through mutation contexts with replay/concurrency metadata.

2. Execution-state persistence repository
- `IImageRunExecutionStateRepository`
- Persist normalized execution state snapshots, progress logs, output snapshots, and replay-safe execution update windows.

3. Readiness resolution
- `IImageRunReadinessResolver`
- Resolve execution readiness in orchestration terms before queue admission/dispatch.

4. Queue orchestration
- `IImageRunQueueOrchestrationPort`
- Enqueue runs and expose scheduler-friendly reservation/claim/release seams without queue backend leakage.

5. Execution handoff
- `IImageRunExecutionHandoffPort`
- Dispatch run-scoped execution handoff requests to an execution adapter through normalized contracts.

6. Execution update ingestion
- `IImageRunExecutionUpdatePort`
- Poll/subscribe to normalized execution updates in run-centric envelopes.

7. Cancellation orchestration
- `IImageRunCancellationOrchestrationPort`
- Request run cancellation with normalized status outcomes.

8. Output handoff notification
- `IImageRunOutputHandoffNotificationPort`
- Publish run output-availability notifications for downstream persistence/lineage workflows.

## Boundary rules

- Application use cases depend on `ImageRunOrchestrationPorts`, not queue clients, transport clients, or ComfyUI-specific APIs.
- Persistence ports are phrased in AI Loom run/orchestration terms (`ImageRunRecord`, queue entry, execution update envelope), not storage schema terms.
- Orchestration ports are transport-agnostic and policy-aware so scheduling/node-assignment logic can evolve without redefining use-case dependencies.
- Output handoff is an explicit application seam; result persistence and lineage adapters remain replaceable infrastructure implementations.

## Scheduling and node-assignment extension posture

- Queue reservation and claim seams are intentionally first-class (`claimRunsForDispatch`, `releaseRunReservation`) to support future scheduler ownership without changing the run-use-case dependency graph.
- Execution handoff keeps queue metadata and run identity together so node assignment and dispatch auditing can remain correlated as placement policies grow.

