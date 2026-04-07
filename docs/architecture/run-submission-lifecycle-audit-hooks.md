# Run Submission and Lifecycle Audit Hooks

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.1: Establish the Authoritative Run Domain and Submission Pipeline
- Story 16.1.7: Record submission and lifecycle audit hooks for the run pipeline

## Purpose

Ensure authoritative run submission is governed by application-level audit hooks so accepted submissions, denied submissions, and key lifecycle transitions are visible through the platform audit posture.

## Canonical implementation files

- `src/application/runs/use-cases/RunSubmissionAudit.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Audit hook boundary

- Hook ownership is application-layer (`ValidateRunSubmissionUseCase`, `CreateAuthoritativeRunUseCase`).
- Hooks are emitted through `RunSubmissionAuditSink` using best-effort dispatch.
- Domain run invariants and lifecycle transition rules remain audit-agnostic.
- Infrastructure translates application audit events into platform audit records through `PlatformRunSubmissionAuditSink`.

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

## Platform mapping

`PlatformRunSubmissionAuditSink` maps application audit event types to platform audit actions:

- `run-submission-accepted` -> `run.submission.accepted` (`outcome: succeeded`)
- `run-submission-denied` -> `run.submission.denied` (`outcome: denied`)
- `run-lifecycle-transitioned` -> `run.lifecycle.transitioned` (`outcome: succeeded`)

All mapped events use:

- `eventKind: runs`
- `workspaceId`, `userIdentityId`, `targetRef` (`run:<runId>`) when available
- resolved actor identity (`actorUserIdentityId`, fallback `actorServiceId`, fallback system identity)

## Test coverage

- `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`
  - denied submission audit emission with actor/workspace context
  - redaction expectations (`parameterCount` present, raw parameter payload absent)
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
  - accepted submission and lifecycle-transition audit emission after persistence
  - best-effort behavior when audit sink dispatch fails
- `src/infrastructure/api/runs/tests/PlatformRunSubmissionAuditSink.test.ts`
  - application-event to platform-audit mapping and outcome semantics
