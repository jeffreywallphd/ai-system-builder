# Run Submission Pipeline and Extension Guardrails

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.1: Establish the Authoritative Run Domain and Submission Pipeline
- Story 16.1.8: Document the run submission pipeline and extension rules for future orchestration work

## Purpose

Document the production authoritative run-submission pipeline as implemented today, identify the supported extension seams for future scheduling/backends/run policies, and explicitly record prohibited shortcuts that would fragment run lifecycle truth.

## Canonical implementation files

- Domain lifecycle/invariants
  - `src/domain/runs/RunDomain.ts`
- Shared run transport contracts and schema parsing
  - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- Application validation and creation orchestration
  - `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
  - `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
  - `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
  - `src/application/runs/use-cases/RunSubmissionValidationRules.ts`
  - `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
  - `src/application/runs/use-cases/RunSubmissionAudit.ts`
  - `src/application/runs/ports/RunSubmissionValidationPorts.ts`
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- Infrastructure adapters and route composition
  - `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
  - `src/infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver.ts`
  - `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
  - `src/hosts/server/IdentityServerHost.ts`

## Authoritative pipeline

1. Client submits `POST /api/v1/runtime/runs/start` using `RunSubmissionRequest` contracts.
2. `IdentityHttpServer` parses/validates payload with shared schema contracts and enforces authenticated workspace/actor context.
3. `AuthoritativeRunSubmissionBackendApi` invokes `SubmitImageRunUseCase`.
4. Submission orchestration validates structure/policy (`ValidateRunSubmissionUseCase` + `RunSubmissionValidationRules`) and applies optional image readiness checks:
   - workspace existence/status
   - permission checks (`system.execute`, optional `workflow.run`, optional `template.instantiate`, plus extra resource references)
   - runtime target resolution (`IRunSubmissionTargetResolverPort`)
   - optional storage policy checks
   - optional encryption prerequisite checks
5. On success, `CreateAuthoritativeRunUseCase` creates the initial canonical run record:
   - lifecycle state `submitted`
   - assignment `unassigned`
   - execution outcome `none`
6. Creation maps canonical state to durable platform record (`RunCreationPersistenceMapper`) and persists:
   - run row via `IAuthoritativeRunPersistenceRepository`
   - orchestration intent audit event (`queue-admission-requested`) via `IRunOrchestrationIntentRepository`
   - transaction boundary via `runInTransactionBoundary` when a transaction manager is configured
7. Creation performs authoritative read-after-write and returns canonical `RunDetail`.
8. Best-effort submission/lifecycle audit hooks are emitted through `RunSubmissionAuditSink` and infrastructure sink mapping.

## Lifecycle and persistence expectations

- Canonical lifecycle truth stays in `RunDomain` and transition helpers.
- Durable run metadata must preserve:
  - canonical run snapshot
  - submission snapshot (actor/target/parameters/references/prerequisites)
  - queue intent (`queue-admission-requested`) and queue id
  - workspace visibility posture
- Queue-aware orchestration starts as an intent record, not scheduler side effects in API handlers.
- Mutation/read transport contracts must remain on `RunOrchestrationTransportContracts` and schema parsers.
- Auditing records governance metadata and redacted counts/flags, not raw sensitive submission payloads.

## Extension points

### New execution backends

- Keep submission acceptance flow unchanged (`ValidateRunSubmissionUseCase` -> `CreateAuthoritativeRunUseCase`).
- Implement/extend target resolution in infrastructure through `IRunSubmissionTargetResolverPort` (for backend availability, allowed parameters, prerequisite ids).
- Add backend-specific runtime dispatch after authoritative run creation through new application orchestration use cases/ports; do not couple dispatch to transport parsing.
- Reuse run lifecycle contracts (`RunDomain` + run transport contracts) for state updates.

### New run types and policies

- Extend submission policy checks in `ValidateRunSubmissionUseCase` and related ports, not in UI or route handlers.
- If run-kind/source-aggregate behavior changes, extend `RunCreationPersistenceMapper` and persist canonical metadata versioning intentionally.
- Add new authorization or policy seams through application ports (authorization/storage/encryption/target resolver) so behavior remains deterministic and testable.
- Keep read projection compatibility by preserving `toRunSummary`, `toRunDetail`, and `toRunStatusEnvelope` semantics.

### New scheduling/queue orchestration

- Consume persisted queue intent and canonical lifecycle states as the source of truth.
- Add assignment/dispatch/cancel/retry orchestration in application services that call domain transition helpers before persistence commits.
- Emit additional lifecycle audit hooks through `RunSubmissionAuditSink` (or successor run-lifecycle audit seam) with redaction-safe details.

## Prohibited shortcuts

- Bypassing authoritative run creation is prohibited. All accepted runs must flow through `CreateAuthoritativeRunUseCase`.
- Embedding orchestration business rules directly inside UI or transport handlers is prohibited.
- Writing run records directly from UI code, route handlers, or backend API adapters is prohibited.
- Introducing new run submission payload parsers outside `RunOrchestrationTransportSchemaContracts` is prohibited.
- Re-defining lifecycle transition legality outside `src/domain/runs/RunDomain.ts` is prohibited.
- Persisting raw sensitive submission payloads into audit details is prohibited when redacted summary metadata is sufficient.

## Verification baseline

- Validation behavior/tests:
  - `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`
- Authoritative creation and transaction behavior/tests:
  - `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
  - `src/application/runs/tests/RunCreationPersistenceMapper.test.ts`
- Submission API and transport behavior/tests:
  - `src/infrastructure/api/runs/tests/AuthoritativeRunSubmissionBackendApi.test.ts`
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRunSubmissionApi.test.ts`
- Shared contracts/schemas tests:
  - `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`
  - `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- Audit sink tests:
  - `src/infrastructure/api/runs/tests/PlatformRunSubmissionAuditSink.test.ts`
