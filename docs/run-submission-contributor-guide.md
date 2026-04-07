# Run Submission Contributor Guide

## Purpose

Provide a practical workflow for contributors extending the authoritative run-submission core without breaking lifecycle truth, policy enforcement, or durable orchestration behavior.

## Canonical docs for this area

- `docs/architecture/run-orchestration-domain-foundation.md`
- `docs/architecture/run-orchestration-transport-contracts.md`
- `docs/architecture/run-submission-validation-policy-eligibility.md`
- `docs/architecture/run-authoritative-creation-persistence-workflow.md`
- `docs/architecture/run-authoritative-submission-api.md`
- `docs/architecture/run-authoritative-read-api.md`
- `docs/architecture/run-submission-lifecycle-audit-hooks.md`
- `docs/architecture/run-submission-pipeline-extension-guardrails.md`

## Required implementation path

1. Add/update shared run contracts and schema parsing first when payload shape changes:
   - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
   - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
2. Add/update application validation and canonical command behavior:
   - `src/application/runs/use-cases/RunSubmissionValidationRules.ts`
   - `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
3. Add/update authoritative creation mapping/persistence:
   - `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
   - `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
   - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
4. Add/update infrastructure adapters:
   - `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
   - `src/infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver.ts`
   - `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
5. Wire server composition and route-family coverage:
   - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
   - `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`
   - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
   - `src/hosts/server/IdentityServerHost.ts`

## Adding a new execution backend

1. Extend/replace the infrastructure target resolver (`IRunSubmissionTargetResolverPort`) to express backend availability, allowed parameter keys, and required policy prerequisite ids.
2. Keep submission acceptance unchanged: validation must still produce `CanonicalRunSubmissionCommand`, then creation persists canonical run and queue intent.
3. Introduce backend dispatch in application orchestration services/use cases after authoritative creation; expose backend operations through ports.
4. Add tests for backend-eligibility denial and successful authoritative acceptance with new backend context.

## Adding a new run type or policy gate

1. Extend canonical validation contracts/normalization and add deterministic issue codes.
2. Extend `ValidateRunSubmissionUseCase` policy checks using existing authorization/storage/security seams or new application ports.
3. If run kind/source aggregate semantics change, update `RunCreationPersistenceMapper` and corresponding mapper tests.
4. Keep read projections stable (`RunSummary`, `RunDetail`, `RunStatusEnvelope`) unless contract migration is intentional and documented.

## Audit and persistence expectations

- Accepted runs must persist canonical run snapshot plus submission/orchestration metadata.
- Initial orchestration intent must be recorded (`queue-admission-requested`) for queue-aware follow-up orchestration.
- Audit hooks must prefer redacted summary data (counts/flags/codes) rather than raw sensitive payload values.

## Prohibited patterns

- Bypassing authoritative run creation is prohibited.
- Embedding orchestration business rules directly inside UI or transport handlers is prohibited.
- Performing direct run persistence writes from route handlers, UI components, or thin backend API wrappers is prohibited.
- Implementing ad-hoc run payload parsers outside shared run schema contracts is prohibited.
- Duplicating lifecycle transition legality outside `src/domain/runs/RunDomain.ts` is prohibited.

## Review checklist

1. Are submission payload and schema updates centralized in shared run transport contracts?
2. Are validation rules and policy/eligibility checks implemented in application use cases (not transport/UI)?
3. Does authoritative creation persist canonical run + orchestration intent under transaction boundary support?
4. Are new extension seams introduced as ports/adapters instead of hard-coding infrastructure dependencies?
5. Are audit details redacted and consistent with existing run submission audit posture?
6. Are `.md` and `.ai.md` docs updated together for this change?
7. Are relevant run-layer tests updated for validation, mapper/persistence, transport, and audit behavior?
