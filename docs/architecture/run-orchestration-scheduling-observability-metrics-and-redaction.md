# Run Orchestration Scheduling Observability, Metrics, and Redaction

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.3: Deliver Scheduling Visibility, Admin Controls, and Production Hardening
- Story 17.3.4: Implement scheduling observability, metrics, and sensitive-data redaction

## Purpose

Provide production-safe scheduler diagnostics by emitting structured, correlatable operational events and metrics for scheduling outcomes while preventing prompt/secret/path/backend-detail leakage.

## Canonical implementation map

- Scheduler governance event contracts and baseline sanitization:
  - `src/application/scheduling/ports/SchedulingGovernanceEventPorts.ts`
- Scheduler governance sink bridging (audit, realtime, observability):
  - `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`
- Shared run orchestration observability logger/metric emission:
  - `src/infrastructure/api/runs/RunOrchestrationObservability.ts`
- Shared run orchestration observability redaction:
  - `src/infrastructure/api/runs/RunOrchestrationObservabilityRedaction.ts`
- Baseline persistence/logging redaction used by observability:
  - `src/infrastructure/logging/PersistenceRedaction.ts`

## Structured scheduler diagnostics

- Operational-channel scheduling governance events now emit structured run orchestration diagnostics with:
  - scheduler event type and scheduler outcome
  - run/workspace/node identifiers where provided
  - decision correlation via `decisionId`
  - reason-code summaries when present and safe
- Severity and markers are aligned to scheduling outcomes:
  - placement/materialization -> informational
  - defer/no-placement and reservation/materialization conflicts -> warning

## Metrics and counters

- Scheduler diagnostics emit `run_orchestration_operation_total` via existing run observability.
- Scheduler-specific counters are emitted via run observability counter metrics, including:
  - decision event totals
  - per-event-type totals
  - per-outcome totals
  - defer/no-placement totals
  - reservation conflict totals
  - assignment materialization conflict totals
  - normalized reason-code totals for decision/exclusion reason codes
- Metric emission remains best-effort and non-blocking.

## Redaction and sensitive-data posture

- Scheduling governance event details are sanitized before sink publication.
- Run orchestration observability applies centralized deep redaction for sensitive keys/values.
- Prompt text, secrets/tokens, raw paths/files/directories, and unsafe backend payload/detail/response fields are redacted.
- Redaction occurs in dedicated infrastructure seams, not in scheduling policy/domain logic.

## Architectural boundaries and invariants

- Scheduler policy logic stays in scheduling application/domain modules.
- Observability, metrics emission, and redaction stay in infrastructure boundaries.
- Governance/audit/realtime/operational telemetry remains best-effort and must not alter scheduling control flow.

## Verification coverage

- `src/application/scheduling/tests/SchedulingGovernanceEventPorts.test.ts`
- `src/infrastructure/api/runs/tests/RunOrchestrationObservability.test.ts`
- `src/infrastructure/api/runs/tests/PlatformSchedulingGovernanceEventSink.test.ts`
- `src/application/runs/tests/SchedulingObservabilityMetricsRedactionDocumentation.test.ts`
