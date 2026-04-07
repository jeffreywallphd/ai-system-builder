# AI Companion: Run Orchestration Scheduling Observability, Metrics, and Redaction

## Story scope
Story 17.3.4 adds production scheduler diagnostics with structured logs, counters/metrics, and centralized redaction of sensitive scheduling details.

## Human doc
- `docs/architecture/run-orchestration-scheduling-observability-metrics-and-redaction.md`

## Canonical files
- `src/application/scheduling/ports/SchedulingGovernanceEventPorts.ts`
- `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`
- `src/infrastructure/api/runs/RunOrchestrationObservability.ts`
- `src/infrastructure/api/runs/RunOrchestrationObservabilityRedaction.ts`
- `src/infrastructure/logging/PersistenceRedaction.ts`

## Core delivery
- Operational scheduling governance events now emit structured run-orchestration observability records.
- Scheduler diagnostics include correlatable IDs (`runId`, `workspaceId`, `nodeId`, `decisionId`) where safe/available.
- Added scheduler outcome counters and key operational metrics for defer/no-placement and reservation/materialization conflicts.
- Added scheduler markers for defer/no-placement and reservation/materialization conflict paths.
- Reason-code arrays are mapped into normalized scheduler reason counters for troubleshooting aggregate behavior.

## Redaction posture
- Scheduling governance detail sanitization now drops path/file/directory and backend detail/response payload keys.
- Run observability redaction now explicitly redacts unsafe backend detail/response fields in addition to prompts, payloads, secrets, tokens, and raw paths.
- Observability and redaction remain in infrastructure adapters, not in scheduler policy logic.

## Tests added/updated
- `src/application/scheduling/tests/SchedulingGovernanceEventPorts.test.ts`
- `src/infrastructure/api/runs/tests/RunOrchestrationObservability.test.ts`
- `src/infrastructure/api/runs/tests/PlatformSchedulingGovernanceEventSink.test.ts`
- `src/application/runs/tests/SchedulingObservabilityMetricsRedactionDocumentation.test.ts`
