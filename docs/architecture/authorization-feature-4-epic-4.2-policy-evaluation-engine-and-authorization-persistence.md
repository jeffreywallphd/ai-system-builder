# Feature 4 / Epic 4.2 Policy Evaluation and Authorization Persistence

## Purpose

Stories 4.2.2-4.2.3 deliver the production policy-evaluation core for Feature 4:

- `EffectivePermissionResolutionService` provides deterministic allow/deny precedence.
- `AuthorizationPolicyDecisionEvaluator` composes actor grants + resource metadata and emits typed authorization decisions for resource-instance and workspace-capability checks.

## Canonical files

- `src/application/authorization/use-cases/EffectivePermissionResolutionService.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
- `src/application/authorization/tests/EffectivePermissionResolutionService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyDecisionEvaluator.test.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`

## Stable interface

`EffectivePermissionResolutionService` remains the deterministic policy core used by higher-level evaluators. `AuthorizationPolicyDecisionEvaluator` is the caller-facing seam for Story 4.2.3:

- accepts actor + permission + target (`resource-instance` or `workspace-capability`),
- loads role/grant state and resource policy metadata when needed,
- returns typed decision payloads with stable denial reasons and optional redaction-safe debug details.

Both evaluators share the same precedence rules.

## Deterministic precedence order

1. Explicit deny permission grants (`PermissionGrant.effect=deny`) matching scope + permission.
2. Owner override (`actorUserIdentityId === ownerUserIdentityId`).
3. Role baseline grants from active, scope-matching role assignments.
4. Explicit allow permission grants (`PermissionGrant.effect=allow`) matching scope + permission.
5. Explicit sharing grants (active + subject match + permission match).
6. Visibility fallback rules:
   - `workspace` visibility allows `read/list` for active workspace membership context.
   - `published` visibility allows `read/list`.
7. Default deny.

## Matching semantics

- Lifecycle filtering applies to role assignments, permission grants, and sharing grants at evaluation `asOf`.
- Scope matching:
  - global -> all resources
  - workspace -> `workspaceId` match
  - resource -> `resourceType/resourceId` match
- Sharing subject matching:
  - user -> actor user identity
  - workspace-role -> matching active workspace role assignment
  - workspace -> active workspace membership context
  - public -> published visibility

## Test coverage

Matrix-style tests validate:

- role-only allow
- owner-only allow
- shared allow (user and workspace-role subjects)
- visibility-driven allow (`workspace`, `published`)
- explicit deny precedence over owner and role grants
- default deny behavior
- batch capability resolution shape
- resource-metadata-missing deterministic deny reason (`resource-policy-metadata-not-found`)
- workspace-capability checks without requiring a concrete resource instance
- optional debug details for safe operational diagnostics (`counts` + `sourceKind` only)

## Extension guidance

- Keep persistence access in repository ports and context-assembly use cases.
- Keep permission-composition logic in `EffectivePermissionResolutionService`.
- Treat precedence changes as policy-versioned changes, not incidental refactors.
