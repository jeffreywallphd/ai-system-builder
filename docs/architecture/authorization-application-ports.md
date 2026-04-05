# Authorization Application Ports and Policy Evaluation Interfaces

This note documents Story 4.1.5 (Feature 4 / Epic 4.1): application-layer authorization ports and policy-evaluation interfaces for decoupled enforcement orchestration.

## Canonical artifacts

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

## Scope and intent

- Define stable application seams for loading authorization context and invoking policy evaluation.
- Keep persistence, transport, and adapter details out of authorization application contracts.
- Make evaluation request/decision DTOs explicit so future SQLite and non-SQLite adapters can implement the same ports.

## Port responsibilities

- `IAuthorizationActorMembershipReadRepository`
  - loads actor workspace-membership records for policy context.
- `IAuthorizationRoleGrantReadRepository`
  - loads actor role assignments and direct permission grants.
- `IAuthorizationResourcePolicyMetadataReadRepository`
  - loads protected-resource ownership/visibility/sharing-policy metadata.
- `IAuthorizationSharingGrantReadRepository`
  - loads explicit sharing grants for the protected resource.
- `IAuthorizationPolicyEvaluator`
  - evaluates a fully resolved actor/resource context and returns a policy decision.
- `IAuthorizationPolicyEventRecorder`
  - optional best-effort sink for policy-evaluation events.

## Adapter behavior expectations

- Ports should return normalized, canonical contract data; they should not return transport/storage rows.
- Adapter lookup filters should honor `asOf` when supported by the backing store.
- `IAuthorizationResourcePolicyMetadataReadRepository` returns `undefined` when resource policy metadata is missing.
- Event recording is non-blocking for authorization behavior: recorder failures should not change allow/deny decisions.

## Use-case boundary

`EvaluateAuthorizationPolicyUseCase` demonstrates the intended application seam:

1. Validate the inbound evaluation request DTO.
2. Load memberships, role grants, sharing grants, and resource policy metadata through ports.
3. Materialize domain-safe `ActorContext` and `ResourcePolicyContext`.
4. Delegate decisioning to `IAuthorizationPolicyEvaluator`.
5. Emit a best-effort evaluation event through `IAuthorizationPolicyEventRecorder` when configured.

## Coverage

`AuthorizationPolicyPortsContracts.test.ts` verifies that:

- in-memory adapters can implement all ports,
- the policy evaluator interface is consumable by application code,
- resolved context and policy decisions flow through typed DTOs,
- missing resource metadata returns a typed failure.
