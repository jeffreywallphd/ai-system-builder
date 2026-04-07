# Run Orchestration Authoritative Retry/Rerun Workflow and Lineage

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.3: Implement Operational Control, Recovery Behavior, and Cross-Surface Orchestration Visibility
- Story 16.3.2: Implement authoritative retry and rerun workflows for eligible failures

## Purpose

Define the production retry/rerun control flow for authoritative runs so eligible failed or cancelled runs can be resubmitted safely through canonical submission pathways while preserving immutable source-run history and explicit lineage.

## Canonical implementation map

- Retry orchestration use case:
  - `src/application/runs/use-cases/RequestAuthoritativeRunRetryUseCase.ts`
- Authoritative run mutation backend retry entry:
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- Identity HTTP retry endpoint mapping:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Canonical creation + metadata lineage persistence:
  - `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
  - `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- Host composition wiring:
  - `src/hosts/server/IdentityServerHost.ts`

## Authoritative retry workflow

1. Authenticated actor calls `POST /api/v1/runtime/runs/:runId/retry` with workspace context.
2. Transport enforces workspace session context and rejects actor spoofing.
3. Backend evaluates `run.retry` authorization for `resourceType=authoritative-run`.
4. Retry use case loads source run and evaluates retry eligibility.
5. Source submission snapshot is converted into a canonical retry submission payload.
6. Retry submission is validated through `ValidateRunSubmissionUseCase`.
7. New run is created through `CreateAuthoritativeRunUseCase` (same authoritative creation path as normal submission).
8. Retry lineage and audit intent are recorded without mutating source-run lifecycle truth.
9. Mutation response returns canonical retried run detail with explicit retry linkage.

## Retry eligibility policy

- Eligible source lifecycle states:
  - `failed`
  - `cancelled`
- Ineligible source lifecycle states:
  - `submitted`, `queued`, `assignment-pending`, `assigned`, `dispatching`, `running`, `cancelling`, `retry-pending`, `completed`
- Ineligible if authoritative submission snapshot metadata is unavailable.

Ineligible requests return explicit failure semantics and do not create new runs.

## Lineage and historical truth rules

- Source run records are immutable during retry request handling (no lifecycle rewrite to `retry-pending` on source history).
- Retried runs are distinct records with new run IDs.
- Retried run retry state carries lineage:
  - `retry.previousRunId`
  - incremented `retry.attempt`
  - non-decreasing `retry.maxAttempts`
  - optional `retry.retryReason`
- Authoritative metadata includes orchestration lineage (`metadata.orchestration.lineage`) for operational query/debug surfaces.

## Canonical submission reuse rules

- Retry logic must not create runs by writing persistence records directly.
- Retry logic must flow through:
  - `ValidateRunSubmissionUseCase`
  - `CreateAuthoritativeRunUseCase`
- This preserves shared policy checks, queue admission behavior, mutation idempotency semantics, and audit consistency.

## Prohibited shortcuts

- Mutating source-run lifecycle state to represent retry linkage is prohibited.
- Constructing retried runs directly in transport or backend handlers is prohibited.
- Bypassing canonical submission validation for retries is prohibited.
- Returning retry success without explicit lineage (`previousRunId` + attempt semantics) is prohibited.

## Verification baseline

- Retry eligibility + lineage use-case coverage:
  - `src/application/runs/tests/RequestAuthoritativeRunRetryUseCase.test.ts`
- Backend retry API behavior:
  - `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- Identity HTTP retry route behavior:
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunRetryApi.test.ts`
