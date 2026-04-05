# AI Companion: Feature 4 / Epic 4.2 Policy Evaluation and Authorization Persistence

## Purpose

Story 4.2.2 adds the first production effective-permission resolver implementation for Feature 4. It deterministically combines role grants, ownership semantics, visibility rules, explicit sharing grants, and deny conditions.

## Canonical files

- `src/application/authorization/use-cases/EffectivePermissionResolutionService.ts`
- `src/application/authorization/tests/EffectivePermissionResolutionService.test.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`

## Stable interface

`EffectivePermissionResolutionService` is reusable in two ways:

- policy-evaluator seam: implements `IAuthorizationPolicyEvaluator` for API enforcement paths.
- capability seam: exposes `resolvePermissions(...)` for batch UI capability checks.

Both paths consume the same actor/resource context contract and use identical precedence.

## Deterministic precedence order

1. Explicit deny permission grants (`PermissionGrant.effect=deny`) that match scope + permission.
2. Owner override when actor user identity matches `resource.ownerUserIdentityId`.
3. Role baseline grants from active, scope-matching role assignments (`owner|admin|member|viewer`).
4. Explicit allow permission grants (`PermissionGrant.effect=allow`) that match scope + permission.
5. Explicit sharing grants with active grant lifecycle and matching subject.
6. Visibility fallback rules:
   - `workspace` visibility allows `read/list` for active workspace membership context.
   - `published` visibility allows `read/list`.
7. Default deny.

## Matching semantics

- Role/permission/sharing entries are filtered by lifecycle timestamps (`grantedAt`, `expiresAt`, `revokedAt`, `assignedAt`) at evaluation `asOf`.
- Scope matching is deterministic:
  - global -> all resources
  - workspace -> `workspaceId` match
  - resource -> `resourceType/resourceId` match
- Sharing subjects are matched by kind:
  - user -> actor user id
  - workspace-role -> active workspace role assignment
  - workspace -> active workspace membership context
  - public -> published visibility

## Verification posture

Matrix-style tests cover:

- role-only allow
- owner-only allow
- explicit shared access (user/workspace-role)
- visibility-driven allow (`workspace`, `published`)
- explicit deny precedence over owner and role
- default deny
- batch capability resolution interface behavior

## Extension guidance

- Keep context loading in repository-backed use cases (`EvaluateAuthorizationPolicyUseCase`) and keep resolution logic inside the resolver service.
- Preserve precedence ordering unless a versioned authorization policy story explicitly changes it.
- Add new role keys via role catalog contracts before expecting role-baseline grants in this resolver.
