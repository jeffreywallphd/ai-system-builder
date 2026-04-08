# AI Companion: Run Submission and Lifecycle Audit Hooks

## Story scope
Story 16.1.7 adds application-level audit hooks for authoritative run submission so governance can observe denied submissions, accepted submissions, and key lifecycle transitions.
Story 18.1.7 extends this slice by faning these events into the canonical authoritative audit service.

## Implemented files
- `src/application/runs/use-cases/RunSubmissionAudit.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
- `src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts`
- `src/infrastructure/audit/AuditFanoutPublishers.ts`
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
- `AuthoritativeRunSubmissionAuditSink` maps the same event types into canonical authoritative run orchestration records.
- Host composition now uses `FanoutRunSubmissionAuditSink` so submission/lifecycle hooks emit to both legacy platform records and authoritative canonical records.

## Tests
- `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/infrastructure/api/runs/tests/PlatformRunSubmissionAuditSink.test.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`
- `src/application/runs/tests/IngestRunExecutionUpdateUseCase.test.ts`

## Story 4.4.3 lifecycle extension
- Extends audit integration to image run lifecycle actions beyond initial submission hooks.
- Additional implementation seams:
  - `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
  - `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
  - `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
  - `src/hosts/server/IdentityServerHost.ts`
- Additional audited actions:
  - `run.dispatch.initiated`
  - `run.lifecycle.transitioned` (including terminal completion/failure/cancelled updates)
  - `run.execution-update.ingested`
  - `run.cancellation.requested`
- Redaction posture:
  - user-safe lifecycle summaries only in shared payload
  - bounded operational fields in admin-only payloads under centralized authoritative recorder sanitization
  - no raw prompt/runtime payload bodies or backend internal blobs
