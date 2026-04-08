# Run Submission and Lifecycle Audit Hooks

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.1: Establish the Authoritative Run Domain and Submission Pipeline
- Story 16.1.7: Record submission and lifecycle audit hooks for the run pipeline

## Purpose

Ensure authoritative run submission is governed by application-level audit hooks so accepted submissions, denied submissions, and key lifecycle transitions are visible through the platform audit posture.
Story 18.1.7 extends this hook path so these events also flow through the canonical authoritative audit service.

## Canonical implementation files

- `src/application/runs/use-cases/RunSubmissionAudit.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
- `src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts`
- `src/infrastructure/audit/AuditFanoutPublishers.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Audit hook boundary

- Hook ownership is application-layer (`ValidateRunSubmissionUseCase`, `CreateAuthoritativeRunUseCase`).
- Hooks are emitted through `RunSubmissionAuditSink` using best-effort dispatch.
- Domain run invariants and lifecycle transition rules remain audit-agnostic.
- Infrastructure composes sink fan-out:
  - `PlatformRunSubmissionAuditSink` preserves legacy run audit records.
  - `AuthoritativeRunSubmissionAuditSink` emits canonical run orchestration audit records.

## Event coverage in this slice

- `run-submission-denied`
  - emitted on validation denial (`invalid-request`, `forbidden`, `not-found`, `policy-ineligible`)
  - includes actor/workspace context when available
- `run-submission-accepted`
  - emitted after authoritative run persistence succeeds
  - includes actor/workspace/run context
- `run-lifecycle-transitioned`
  - emitted for initial submission lifecycle initialization (`none` -> `submitted`)
  - includes actor/workspace/run context

## Redaction and payload posture

This slice intentionally records structured summary metadata and omits raw potentially sensitive payloads:

- records counts and flags for parameters/metadata/references/prerequisites instead of raw values
- records issue codes and issue-kind counts instead of full validation issue messages/details payloads
- records runtime target identifiers and queue context needed for governance traceability
- does not emit raw `parameters`, raw `metadata`, or `idempotencyKey` values in audit details

## Story 4.4.3 lifecycle extension (image run orchestration)

Feature 4.4 extends run audit coverage from submission-only hooks to image run lifecycle mutations executed through authoritative orchestration services.

Additional canonical implementation files:

- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
- `src/hosts/server/IdentityServerHost.ts`

Additional audited actions in this extension:

- `run.dispatch.initiated`
  - emitted when authoritative dispatch handling records dispatch initiation for a run attempt
  - captures workspace/run/actor context and dispatch-attempt correlation
- `run.lifecycle.transitioned`
  - emitted from dispatch result handling and execution-update ingestion for lifecycle progression
  - includes terminal completion/failure/cancelled transitions
- `run.execution-update.ingested`
  - emitted for non-transitioning progress/heartbeat/internal-diagnostics execution updates
- `run.cancellation.requested`
  - emitted for cancellation request outcomes (`cancelled`, `cancellation-requested`, `already-finalized`, `already-cancelling`, `denied`)

Redaction posture for this extension:

- user-safe payloads keep lifecycle states, outcome codes, and minimal transition metadata
- admin-only payloads carry operational troubleshooting fields (for example dispatch attempt id or idempotency key) and remain recorder-sanitized by the authoritative audit service
- raw execution payload bodies, raw prompt data, and backend-internal blobs remain excluded from run audit payloads

## Platform mapping

Run submission audit adapters map application audit event types to stable orchestration actions:

- `run-submission-accepted` -> `run.submission.accepted` (`outcome: succeeded`)
- `run-submission-denied` -> `run.submission.denied` (`outcome: denied`)
- `run-lifecycle-transitioned` -> `run.lifecycle.transitioned` (`outcome: succeeded`)

All mapped events use:

- `eventKind: runs`
- `workspaceId`, `userIdentityId`, `targetRef` (`run:<runId>`) when available
- resolved actor identity (`actorUserIdentityId`, fallback `actorServiceId`, fallback system identity)
- canonical authoritative adapter keeps the same action vocabulary and records workspace/run protected-resource references for governance joins

## Test coverage

- `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`
  - denied submission audit emission with actor/workspace context
  - redaction expectations (`parameterCount` present, raw parameter payload absent)
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
  - accepted submission and lifecycle-transition audit emission after persistence
  - best-effort behavior when audit sink dispatch fails
- `src/infrastructure/api/runs/tests/PlatformRunSubmissionAuditSink.test.ts`
  - application-event to platform-audit mapping and outcome semantics
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`
- `src/application/runs/tests/IngestRunExecutionUpdateUseCase.test.ts`
  - application-event to authoritative canonical run audit mapping
