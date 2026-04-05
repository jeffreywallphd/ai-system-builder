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

## Contract summary

- Request DTO: actor reference + resource reference + permission key + optional `asOf`/correlation id.
- Decision DTO: `PolicyDecision` + resolved context payload (memberships, role grants, sharing grants, resource metadata).
- Port seams isolate context loading (`memberships`, `role grants`, `sharing grants`, `resource metadata`) from policy evaluation and event recording.

## Boundary posture

- No infrastructure types in application contracts.
- Policy evaluator is a dedicated application interface (`IAuthorizationPolicyEvaluator`) so enforcement logic remains swappable.
- Resource-scoped and workspace-capability decisions are also available through `IAuthorizationPolicyDecisionEvaluator`, which centralizes actor/action/target evaluation for runtime callers.
- Event recording is optional and best-effort (`IAuthorizationPolicyEventRecorder`) for both decision summaries and mutation audit events.
- `IAuthorizationResourcePolicyMetadataReadRepository` also supports list metadata lookup for authorization-aware list/search composition.

## Expected adapter behavior

- Return canonical contract fields, not storage row models.
- Respect `asOf` when possible.
- Return `undefined` for missing resource policy metadata.
- Do not let event-recorder failures mutate policy outcomes.

## Consumer seam

`EvaluateAuthorizationPolicyUseCase` is the example consumer that composes all ports, builds domain-safe contexts, delegates to `IAuthorizationPolicyEvaluator`, and returns typed decision results.

Runtime callers should use `IAuthorizationPolicyDecisionEvaluator` to avoid duplicating context-loading and precedence logic.

## Current production evaluator baseline

- `EffectivePermissionResolutionService` is the first concrete `IAuthorizationPolicyEvaluator` implementation (Story 4.2.2).
- It also exposes a batch `resolvePermissions(...)` seam for UI capability checks, reusing the same precedence used for enforcement decisions.
- `AuthorizationPolicyDecisionEvaluator` (Story 4.2.3) composes role/grant/resource metadata loading and `EffectivePermissionResolutionService` into one reusable decision seam that returns typed allow/deny results with stable denial reasons.
- `AuthorizedResourceQueryService` (Story 4.2.5) composes metadata listing + per-resource decision evaluation into a reusable authorized list/search helper with workspace scope and owner/shared filters.

Authoritative precedence order inside `EffectivePermissionResolutionService`:

1. explicit deny permission grants
2. owner override
3. role baseline grants
4. explicit allow permission grants
5. explicit sharing grants
6. visibility fallback (`workspace`/`published` for `read|list`)
7. default deny

This order is policy behavior, not an implementation detail; do not reimplement it outside evaluator services.

## Repository loading responsibility map

- role assignments + permission grants -> `IAuthorizationRoleGrantReadRepository`
- resource metadata (owner/workspace/visibility/sharing policy) -> `IAuthorizationResourcePolicyMetadataReadRepository`
- sharing grants -> `IAuthorizationSharingGrantReadRepository`
- allow/deny composition -> `AuthorizationPolicyDecisionEvaluator` + `EffectivePermissionResolutionService`

For protected list/search views, compose `AuthorizedResourceQueryService` first, then hydrate feature-specific rows by authorized keys.

## Audit-safe event shape (Story 4.2.6)

- `IAuthorizationPolicyEventRecorder` now accepts a union of authorization recorded events:
  - evaluated decision summary,
  - denied decision summary,
  - mutation audit events for role/sharing/visibility-policy writes.
- Decision events include actor/workspace/resource references, permission, outcome, reason code, and compact counts only.
- Mutation events include actor/workspace/resource references and mutation semantics (`entityKind`, `mutationKind`, `operationKey`, `changed`, `wasReplay`).
- Free-form mutation reason/metadata is redacted through `AuthorizationAuditRedaction.ts` before emission.
- Recorder failures are intentionally non-blocking so policy and mutation outcomes are not coupled to telemetry transport health.

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

Mutation gate summary:

- workspace role assignment/removal -> `system.manage` capability
- sharing grant upsert/revoke -> `<resource-family>.share`
- visibility updates -> `<resource-family>.manage`

## Caching posture reference

- Story 4.2.4 caching is adapter-local in `SqliteAuthorizationPersistenceAdapter` for role/sharing/resource-policy read hot paths.
- Invalidation is explicit and mutation-scoped.
- Evaluator services intentionally do not cache final decisions.
