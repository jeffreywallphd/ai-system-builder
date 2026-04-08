# AI Companion: Image Run Orchestration Application Ports

## Story scope
Story 4.1.3 defines the application-layer repository and orchestration service ports for authoritative image runs.

## Canonical files
- `src/application/image-workflows/ports/ImageRunOrchestrationPorts.ts`
- `src/application/image-workflows/ports/index.ts`
- `src/application/image-workflows/tests/ImageRunOrchestrationPorts.test.ts`
- `docs/architecture/image-run-orchestration-application-ports.md`

## Coverage summary
- Authoritative image-run metadata persistence (`create/read/update/list`).
- Execution-state persistence for normalized snapshots/progress/output updates.
- Readiness-resolution seam before queue admission.
- Queue orchestration seam (enqueue + optional claim/release hooks for scheduler ownership).
- Execution handoff seam that remains adapter-neutral at use-case boundaries.
- Update polling/subscription seam for normalized orchestration updates.
- Cancellation seam with normalized status outcomes.
- Output-handoff notification seam for downstream result/lineage persistence.

## Boundary posture
- Business logic depends on orchestration ports, not concrete queue transports or backend execution clients.
- Run orchestration remains authoritative for lifecycle flow and execution-update normalization.
- Persistence, transport, and adapter implementations remain infrastructure concerns behind these ports.
- Scheduler/node-assignment evolution can plug into existing queue reservation and dispatch-correlation seams without redesigning use-case contracts.

