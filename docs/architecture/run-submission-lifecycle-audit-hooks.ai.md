# AI Companion: Run Submission and Lifecycle Audit Hooks

## Story scope
Story 16.1.7 adds application-level audit hooks for authoritative run submission so governance can observe denied submissions, accepted submissions, and key lifecycle transitions.

## Implemented files
- `src/application/runs/use-cases/RunSubmissionAudit.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
- `src/hosts/server/IdentityServerHost.ts`
- Human doc: `docs/architecture/run-submission-lifecycle-audit-hooks.md`

## Hook boundary
- Emission stays in run application use cases through `RunSubmissionAuditSink`.
- Dispatch is best-effort; run submission behavior does not fail on audit sink errors in this story.
- Domain lifecycle and invariants remain independent of audit infrastructure.

## Emitted event types
- `run-submission-denied` (validation denials)
- `run-submission-accepted` (post-persistence acceptance)
- `run-lifecycle-transitioned` (initial `none` -> `submitted`)

## Redaction posture
- Audit details include structured counts/flags and governance-safe identifiers.
- Raw submission payload values (`parameters`, `metadata`, idempotency key values) are intentionally omitted.

## Platform integration
- `PlatformRunSubmissionAuditSink` maps events into platform audit records (`eventKind: runs`) with stable actions:
  - `run.submission.denied`
  - `run.submission.accepted`
  - `run.lifecycle.transitioned`
- Authoritative host composition now wires the sink into run validation and creation use cases.

## Tests
- `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/infrastructure/api/runs/tests/PlatformRunSubmissionAuditSink.test.ts`
