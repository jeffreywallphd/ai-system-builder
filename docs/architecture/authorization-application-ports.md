# Authorization Application Ports and Policy Evaluation Interfaces

This note documents Story 4.1.5 (Feature 4 / Epic 4.1): application-layer authorization ports and policy-evaluation interfaces for decoupled enforcement orchestration.

## Canonical artifacts

- `src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts.ts`
- `src/application/authorization/ports/IAuthorizationActorMembershipReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationRoleGrantReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationSharingGrantReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository.ts`
- `src/application/authorization/ports/IAuthorizationPolicyEvaluator.ts`
- `src/application/authorization/ports/IAuthorizationPolicyDecisionEvaluator.ts`
- `src/application/authorization/ports/IAuthorizationPolicyEventRecorder.ts`
- `src/application/authorization/ports/AuthorizationPolicyEvaluationPorts.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`
- `src/application/authorization/use-cases/EffectivePermissionResolutionService.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
- `src/application/authorization/use-cases/AuthorizedResourceQueryService.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyMutationService.ts`
- `src/application/authorization/use-cases/AuthorizationAuditRedaction.ts`
- `src/application/authorization/use-cases/AuthorizationAdministrationUseCaseShared.ts`
- `src/application/authorization/use-cases/AssignAuthorizationRoleUseCase.ts`
- `src/application/authorization/use-cases/RemoveAuthorizationRoleUseCase.ts`
- `src/application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase.ts`
- `src/application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase.ts`
- `src/application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPermissionUseCase.ts`
- `src/application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase.ts`
- `src/application/authorization/tests/AuthorizationPolicyPortsContracts.test.ts`
- `src/application/authorization/tests/EffectivePermissionResolutionService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyDecisionEvaluator.test.ts`
- `src/application/authorization/tests/AuthorizedResourceQueryService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyMutationService.test.ts`

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
- `IAuthorizationPolicyDecisionEvaluator`
  - evaluates actor + permission + target (`resource-instance` or `workspace-capability`) and returns a typed allow/deny decision with stable denial reason semantics.
- `IAuthorizationPolicyEventRecorder`
  - optional best-effort sink for audit-safe decision and mutation events.
- `IAuthorizationResourcePolicyMetadataReadRepository`
  - supports both single-resource metadata lookup and workspace-aware metadata listing for authorization-filtered list/search use cases.

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

## Current evaluator baseline (Stories 4.2.2-4.2.3)

- `EffectivePermissionResolutionService` is the concrete `IAuthorizationPolicyEvaluator` implementation for effective-permission resolution.
- The service also exposes `resolvePermissions(...)` for batch capability checks in UI and thin-client surfaces, using the same precedence as enforcement decisions.
- `AuthorizationPolicyDecisionEvaluator` is the concrete `IAuthorizationPolicyDecisionEvaluator` implementation for runtime callers that have actor/action/target references and need centralized decision resolution without ad hoc policy checks.
- `AuthorizedResourceQueryService` (Story 4.2.5) is the reusable authorization-aware list/search helper that composes workspace metadata listing and per-resource decision evaluation with owner/shared filters.

## Audit-safe event shape (Story 4.2.6)

- `IAuthorizationPolicyEventRecorder` now accepts a union of authorization recorded events:
  - evaluated decision summary,
  - denied decision summary,
  - mutation audit events for role/sharing/visibility-policy writes.
- Decision events include actor/workspace/resource references, permission, outcome, reason code, and compact counts only.
- Mutation events include actor/workspace/resource references and mutation semantics (`entityKind`, `mutationKind`, `operationKey`, `changed`, `wasReplay`).
- Free-form mutation reason/metadata is redacted through `AuthorizationAuditRedaction.ts` before emission.

## Administration command/query seams (Story 4.2.7)

- Authorization administration now exposes first-class application use cases so controllers/pages can call stable commands/queries instead of embedding policy logic:
  - role assignment commands (`AssignAuthorizationRoleUseCase`, `RemoveAuthorizationRoleUseCase`)
  - sharing commands (`GrantAuthorizationSharingAccessUseCase`, `RevokeAuthorizationSharingAccessUseCase`)
  - visibility command (`UpdateAuthorizationVisibilityUseCase`)
  - permission query (`EvaluateAuthorizationPermissionUseCase`)
  - effective-access query (`ListAuthorizationEffectiveAccessUseCase`)
- Command/query payloads are validated with Epic 4.1 authorization schemas.
- Administrative mutations enforce actor authorization through `IAuthorizationPolicyDecisionEvaluator` before persistence writes.
- Mutation side effects remain centralized in `AuthorizationPolicyMutationService` to preserve audit-event emission behavior.

## Coverage

`AuthorizationPolicyPortsContracts.test.ts` verifies that:

- in-memory adapters can implement all ports,
- the policy evaluator interface is consumable by application code,
- resolved context and policy decisions flow through typed DTOs,
- missing resource metadata returns a typed failure.
