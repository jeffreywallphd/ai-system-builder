# AI Companion: Run Orchestration Authoritative Retry/Rerun Workflow and Lineage

## Story scope
Story 16.3.2 implements authoritative retry/rerun behavior for eligible failed/cancelled runs with explicit eligibility policy, immutable source-run truth, and canonical lineage-aware resubmission.

## Canonical doc
- `docs/architecture/run-orchestration-authoritative-retry-rerun-workflow-and-lineage.md`

## Implemented seams
- Retry orchestration use case:
  - `src/application/runs/use-cases/RequestAuthoritativeRunRetryUseCase.ts`
- Retry mutation backend API entry:
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- Identity HTTP retry route:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Creation + lineage persistence wiring:
  - `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
  - `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- Host composition:
  - `src/hosts/server/IdentityServerHost.ts`

## Core behavior summary
- Retry requests are accepted only for source runs in `failed` or `cancelled`.
- Retry requests are rejected when source submission snapshot metadata is unavailable.
- Retry resubmission reuses canonical submission pipeline (`ValidateRunSubmissionUseCase` + `CreateAuthoritativeRunUseCase`).
- Source runs remain immutable; retries create new run records.
- Retried runs carry explicit lineage (`retry.previousRunId`, incremented attempt, optional reason) plus orchestration metadata lineage.

## Guardrails
- Transport/backend handlers must not persist retried runs directly.
- Retry success must include explicit linkage to source run.
- Ineligible retries must return explicit failure semantics.
