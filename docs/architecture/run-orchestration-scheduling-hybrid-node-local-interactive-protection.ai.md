# AI Companion: Hybrid-Node Local Interactive Protection Rules

## Story scope
Story 17.1.5 implements explicit hybrid-node local interactive protection rules in the authoritative scheduling policy pipeline.

## Human doc
- `docs/architecture/run-orchestration-scheduling-hybrid-node-local-interactive-protection.md`

## Implemented files
- `src/domain/scheduling/SchedulingDomain.ts`
- `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- `src/domain/scheduling/tests/SchedulingDomain.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`

## Core delivery
- Extends scheduling node policy inputs with explicit hybrid protection signals:
  - reserved local capacity counters
  - protected local-user windows
- Keeps hybrid local-use protection in domain/application scheduling seams.
- Preserves explainable denial output using `hybrid-local-interactive-protection` with `protectionKind`.
- Ensures authoritative scheduling can defer when all hybrid candidates are blocked by local-use protections.

## Implemented protection posture
- Interactive local session: deny remote assignment on hybrid nodes, with same-user reuse exception.
- Reserved local capacity: deny when active remote load reaches reserved local threshold.
- Protected local-user window: deny during active window, with protected-user exception when configured.

## Boundary posture
- Scheduling policy remains in `src/domain/scheduling/*` and `src/application/scheduling/*`.
- Local-use protection is not implemented in transport handlers, persistence adapters, node executors, or dispatch adapters.

## Limitations in this slice
- No fine-grained resource-pressure arbitration in this story.
- No recurring calendar windows or profile-specific overrides yet.
- No score-only deprioritization model yet; this release enforces eligibility gating.

