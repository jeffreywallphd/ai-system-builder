# AI Companion: Feature 4 / Epic 4.1 Authorization Baseline

## Purpose

Implementation-truth handoff for the authorization foundation delivered in Epic 4.1.

## What is complete now

- Domain contracts for RBAC, visibility, sharing, and policy-decision models.
- Canonical permission catalog (`<resource-family>.<action>`) across asset/system/workflow/template/run/queue/log/storage-instance/secret-metadata/artifact.
- Workspace role catalog (`owner`, `admin`, `member`, `viewer`) with baseline grants and override seam.
- Reusable protected-resource authorization contract + legacy adaptation helper.
- Application policy-evaluation orchestration seam (`EvaluateAuthorizationPolicyUseCase`) with typed outcomes and optional best-effort event recording.
- Shared schema validation contracts for evaluation/sharing/visibility/role-assignment/resource-policy payloads.
- Persistence DTO + repository contracts for role assignments, sharing grants, and resource policy metadata with idempotency and revision support.

## Canonical files

- `src/domain/authorization/AuthorizationDomain.ts`
- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/domain/authorization/AuthorizationRoleDefinitions.ts`
- `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`
- `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts`
- `src/shared/dto/authorization/AuthorizationPersistenceDtos.ts`

## Current non-goals (still downstream)

- No production policy evaluator adapter implementation yet (`IAuthorizationPolicyEvaluator` is a seam).
- No full runtime-wide enforcement wiring for all protected features yet.
- No finalized authorization admin transport APIs yet.

## Permission-check flow baseline

1. Validate request actor + permission key.
2. Load resource policy metadata (required).
3. Load memberships, role/permission grants, and sharing grants via ports.
4. Build `ActorContext` and `ResourcePolicyContext` through domain constructors.
5. Delegate decision to `IAuthorizationPolicyEvaluator`.
6. Return decision + resolved context, and record optional best-effort event.

## Extension rules to preserve

- Add permissions through `AuthorizationPermissionActionMatrix`, not literals.
- Keep role keys stable unless a versioned contract story changes them.
- Attach new resources via `ProtectedResourceAuthorizationContract`.
- Keep evaluator logic in evaluator adapters and context-loading logic in use cases/ports.
- Preserve mutation idempotency (`operationKey`) and optional optimistic concurrency (`expectedRevision`) in persistence adapters.

## Related docs

- `docs/architecture/authorization-feature-4-epic-4.1-baseline.md`
- `docs/architecture/authorization-foundation.md`
- `docs/architecture/authorization-application-ports.md`
- `docs/architecture/authorization-persistence-contracts.md`

