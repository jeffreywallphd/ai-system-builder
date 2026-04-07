# AI Companion: Scheduling Deployment-Profile Policy Seams

## Story scope
Story 17.3.6 validates explicit scheduler seams for deployment-profile policy growth without shipping placeholder profile behavior.

## Human doc
- `docs/architecture/run-orchestration-scheduling-deployment-profile-policy-seams.md`

## Implemented files
- `src/application/scheduling/ports/SchedulingPolicyProfilePorts.ts`
- `src/application/scheduling/use-cases/AssembleAuthoritativeSchedulingInputUseCase.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/application/scheduling/tests/AssembleAuthoritativeSchedulingInputUseCase.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/application/runs/tests/SchedulingDeploymentProfilePolicySeamsDocumentation.test.ts`

## Core delivery
- Adds `ISchedulingDeploymentProfilePolicyContextPort` so snapshot assembly can resolve deployment-profile policy context from authoritative sources.
- Adds `ISchedulingPolicyRuleSetProvider` so scheduler policy rule/scoring/source wiring can vary per evaluation snapshot.
- Keeps default production scheduling behavior unchanged when no profile rule-set provider is configured.
- Keeps policy-source traceability extensible for future quota/time-window/affinity overlays.

## Guardrail
- avoid shipping placeholder profile toggles
- no mock classroom/organization policy switches are enabled in this story
- future profile behavior should be implemented as concrete rule/provider adapters through these seams
