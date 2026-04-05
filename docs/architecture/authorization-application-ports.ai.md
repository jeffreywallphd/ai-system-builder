# AI Companion: Authorization Application Ports and Policy Evaluation Interfaces

## Purpose

Story 4.1.5 defines application-layer authorization seams so policy evaluation orchestration is stable before persistence/transport adapters are implemented.

## Canonical files

- `src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts.ts`
- `src/application/authorization/ports/IAuthorizationActorMembershipReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationRoleGrantReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationSharingGrantReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationPolicyEvaluator.ts`
- `src/application/authorization/ports/IAuthorizationPolicyEventRecorder.ts`
- `src/application/authorization/ports/AuthorizationPolicyEvaluationPorts.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`
- `src/application/authorization/tests/AuthorizationPolicyPortsContracts.test.ts`

## Contract summary

- Request DTO: actor reference + resource reference + permission key + optional `asOf`/correlation id.
- Decision DTO: `PolicyDecision` + resolved context payload (memberships, role grants, sharing grants, resource metadata).
- Port seams isolate context loading (`memberships`, `role grants`, `sharing grants`, `resource metadata`) from policy evaluation and event recording.

## Boundary posture

- No infrastructure types in application contracts.
- Policy evaluator is a dedicated application interface (`IAuthorizationPolicyEvaluator`) so enforcement logic remains swappable.
- Event recording is optional and best-effort (`IAuthorizationPolicyEventRecorder`).

## Expected adapter behavior

- Return canonical contract fields, not storage row models.
- Respect `asOf` when possible.
- Return `undefined` for missing resource policy metadata.
- Do not let event-recorder failures mutate policy outcomes.

## Consumer seam

`EvaluateAuthorizationPolicyUseCase` is the example consumer that composes all ports, builds domain-safe contexts, delegates to `IAuthorizationPolicyEvaluator`, and returns typed decision results.
