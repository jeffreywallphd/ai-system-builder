# AI Companion: Run Submission Pipeline Extension Guardrails

## Story scope
Story 16.1.8 documents the authoritative run-submission pipeline, extension seams for future backend/scheduling work, and prohibited architecture shortcuts.

## Human doc
- `docs/architecture/run-submission-pipeline-extension-guardrails.md`

## Canonical pipeline anchors
- `src/domain/runs/RunDomain.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/ports/RunSubmissionValidationPorts.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
- `src/infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver.ts`
- `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Pipeline summary
- Transport parses canonical run submission payloads and enforces authenticated workspace/actor context.
- Application submission orchestration (`SubmitImageRunUseCase`) coordinates validation, readiness findings, and accepted-response shaping.
- Validation use case normalizes structure and evaluates authorization/availability/policy prerequisites.
- Authoritative creation use case persists canonical run + queue-admission orchestration intent under transaction boundary support.
- Read-after-write returns canonical run detail and emits best-effort redacted audit hooks.

## Extension rules
- New backends integrate by implementing/extending `IRunSubmissionTargetResolverPort` and later dispatch orchestration ports/use cases.
- New run policies/run kinds extend application and mapper seams, not transport parsing.
- New scheduling/queue orchestration consumes persisted queue intent and canonical lifecycle state transitions.

## Non-negotiable prohibitions
- Bypassing authoritative run creation is prohibited.
- Embedding orchestration business rules directly inside UI or transport handlers is prohibited.
- Direct run-record mutation from transport/UI layers is prohibited.
- Redefining lifecycle truth outside `RunDomain` is prohibited.
