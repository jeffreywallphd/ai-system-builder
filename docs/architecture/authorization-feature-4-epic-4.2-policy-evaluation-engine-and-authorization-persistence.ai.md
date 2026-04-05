# AI Companion: Feature 4 / Epic 4.2 Policy Evaluation and Authorization Persistence

## Purpose

Stories 4.2.2-4.2.3 deliver the production policy-evaluation core for Feature 4:

- `EffectivePermissionResolutionService` provides deterministic allow/deny precedence.
- `AuthorizationPolicyDecisionEvaluator` composes actor grants + resource metadata and emits typed decisions for resource-instance and workspace-capability checks.

Story 4.2.4 adds optional hot-path caching for authorization persistence reads used repeatedly by policy-evaluation and list screens.
Story 4.2.5 adds reusable authorization-aware list/search query composition so workspace views only return resources visible to the requesting actor.
Story 4.2.6 adds audit-friendly authorization event emission for mutation operations and deny-focused decision outcomes.

## Canonical files

- `src/application/authorization/use-cases/EffectivePermissionResolutionService.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
- `src/application/authorization/tests/EffectivePermissionResolutionService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyDecisionEvaluator.test.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`
- `src/application/authorization/use-cases/AuthorizedResourceQueryService.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyMutationService.ts`
- `src/application/authorization/use-cases/AuthorizationAuditRedaction.ts`
- `src/application/authorization/tests/AuthorizedResourceQueryService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyMutationService.test.ts`
- `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
- `src/infrastructure/persistence/authorization/tests/SqliteAuthorizationPersistenceAdapter.test.ts`

## Stable interface

`EffectivePermissionResolutionService` remains reusable in two ways:

- policy-evaluator seam: implements `IAuthorizationPolicyEvaluator` for API enforcement paths.
- capability seam: exposes `resolvePermissions(...)` for batch UI capability checks.

Both paths consume the same actor/resource context contract and use identical precedence.

Story 4.2.3 adds `AuthorizationPolicyDecisionEvaluator` as the caller-facing evaluator seam:

- accepts actor + permission + target (`resource-instance` or `workspace-capability`),
- loads role/grant state and resource metadata for resource-instance checks,
- reuses effective-permission precedence for the final allow/deny decision,
- returns typed decision envelopes with stable denial reasons and optional redaction-safe debug details.

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
- resource policy metadata missing behavior with deterministic deny reason
- workspace-capability checks that do not require a concrete resource id
- optional debug payload shape for operational diagnostics
- cache-enabled memoization for role-assignment, sharing-grant, and resource-policy read hot paths
- mutation-driven cache invalidation for role/sharing/visibility policy changes
- cache-disabled behavior parity (optional cache usage)

## Caching and invalidation guidance (Story 4.2.4)

- `SqliteAuthorizationPersistenceAdapter` now provides an optional in-memory cache (enabled by default) for:
  - `listRoleAssignments(...)`
  - `listSharingGrants(...)`
  - `findResourcePolicyMetadata(...)`
  - `listResourcePolicyMetadata(...)`
- Cache keys include workspace/resource lookup dimensions, actor/subject filters, lifecycle filters (`asOf`, include flags), and paging fields.
- Invalidation is mutation-scoped and explicit:
  - role-assignment writes clear role-assignment list cache,
  - sharing-grant writes clear sharing-grant list cache,
  - resource-policy writes evict direct resource metadata cache entry and clear resource-policy list cache.
- Cache size is bounded per store (`maxEntriesPerStore`) to keep memory usage predictable.
- Caching remains optional:
  - `new SqliteAuthorizationPersistenceAdapter(path, { cache: { enabled: false } })`

## Authorized list/search query guidance (Story 4.2.5)

- `AuthorizedResourceQueryService` is the reusable seam for list and search surfaces that need authorization-filtered resource sets.
- The service accepts actor context + workspace scope + required permission key and then:
  - loads candidate metadata with workspace-aware filters from `IAuthorizationResourcePolicyMetadataReadRepository.listResourcePolicyMetadata(...)`,
  - applies optional resource-family/resource-type/search filters,
  - delegates allow/deny decisions per candidate to `IAuthorizationPolicyDecisionEvaluator`,
  - supports relation filtering for owner/shared slices (`owner`, `shared`),
  - emits deterministic paged results.
- Resource modules should compose this helper first and only hydrate domain-specific read models for the returned authorized resource keys.

Example integration pattern:

1. Call `listAuthorizedResources(...)` for the workspace + permission (`asset.read`, `log.read`, `queue.read`, etc.).
2. Use returned `{ resourceFamily, resourceType, resourceId }` keys to query module repositories.
3. Preserve returned ordering/pagination to keep deterministic list/search behavior across desktop and thin-client surfaces.

## Extension guidance

- Keep context loading in repository-backed use cases (`EvaluateAuthorizationPolicyUseCase`) and keep resolution logic inside the resolver service.
- Preserve precedence ordering unless a versioned authorization policy story explicitly changes it.
- Add new role keys via role catalog contracts before expecting role-baseline grants in this resolver.

## Audit event integration (Story 4.2.6)

- Decision event emission remains best-effort and non-blocking via `IAuthorizationPolicyEventRecorder`.
- `EvaluateAuthorizationPolicyUseCase` now emits compact, audit-safe decision summaries:
  - `authorization-policy-evaluated` for all completed evaluations.
  - `authorization-policy-denied` for deny outcomes.
- Full request/resolved-context snapshots are intentionally not emitted in events to avoid over-logging sensitive or verbose content.
- `AuthorizationPolicyMutationService` is the application mutation seam that wraps authorization persistence mutations and emits structured mutation events for:
  - role assignment upsert/revoke,
  - sharing grant upsert/revoke,
  - resource policy upsert/soft-delete.
- Audit metadata redaction is centralized in `AuthorizationAuditRedaction.ts`, which masks sensitive keys (for example `token`, `password`, `credential`, `apiKey`) and truncates long free-form strings.
