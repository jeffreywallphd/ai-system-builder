# Feature 4 / Epic 4.2 Policy Evaluation and Authorization Persistence

## Purpose

Stories 4.2.2-4.2.3 deliver the production policy-evaluation core for Feature 4:

- `EffectivePermissionResolutionService` provides deterministic allow/deny precedence.
- `AuthorizationPolicyDecisionEvaluator` composes actor grants + resource metadata and emits typed authorization decisions for resource-instance and workspace-capability checks.

Story 4.2.4 adds optional hot-path caching for authorization persistence reads used repeatedly by policy-evaluation and list screens.
Story 4.2.5 adds reusable authorization-aware list/search query composition so workspace views only return resources visible to the requesting actor.
Story 4.2.6 adds audit-friendly authorization event emission for mutation operations and deny-focused decision outcomes.
Story 4.2.7 adds production application command/query use cases for authorization administration and permission/effective-access reads.

## Canonical files

- `src/application/authorization/use-cases/EffectivePermissionResolutionService.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
- `src/application/authorization/tests/EffectivePermissionResolutionService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyDecisionEvaluator.test.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`
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
- `src/application/authorization/tests/AuthorizedResourceQueryService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyMutationService.test.ts`
- `src/application/authorization/tests/AuthorizationAdministrationUseCases.test.ts`
- `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
- `src/infrastructure/persistence/authorization/tests/SqliteAuthorizationPersistenceAdapter.test.ts`

## Stable interface

`EffectivePermissionResolutionService` remains the deterministic policy core used by higher-level evaluators. `AuthorizationPolicyDecisionEvaluator` is the caller-facing seam for Story 4.2.3:

- accepts actor + permission + target (`resource-instance` or `workspace-capability`),
- loads role/grant state and resource policy metadata when needed,
- returns typed decision payloads with stable denial reasons and optional redaction-safe debug details.

Both evaluators share the same precedence rules.

## Request-to-decision path

Use this sequence when tracing an allow/deny result:

1. Entry point selects the seam:
   - `EvaluateAuthorizationPolicyUseCase` when the caller already has a concrete resource.
   - `AuthorizationPolicyDecisionEvaluator` when the caller has actor + permission + target and needs resource/workspace-capability composition.
2. Actor context is validated (`actorUserIdentityId` or `actorServiceId` required).
3. Permission key is normalized with `createPermissionKey(...)`; invalid keys return deny/failure.
4. Role/permission snapshot is loaded from `IAuthorizationRoleGrantReadRepository`.
5. Resource-instance path:
   - load metadata from `IAuthorizationResourcePolicyMetadataReadRepository.findResourcePolicyMetadata(...)`,
   - load sharing grants from `IAuthorizationSharingGrantReadRepository.listSharingGrants(...)`,
   - materialize domain-safe actor/resource contexts.
6. Workspace-capability path:
   - build synthetic private resource context (`workspace-capability:<workspaceId>:<capabilityResourceType>`),
   - skip resource metadata/sharing-grant reads.
7. Delegate to `EffectivePermissionResolutionService.resolvePermission(...)`.
8. Return typed decision (`isAllowed`, `outcome`, `reasonCode`, optional `denialReason`, matched ids).
9. Optionally emit best-effort audit events (`evaluated` always; `denied` on deny outcomes).

`resource-policy-metadata-not-found` is a deterministic deny for resource-instance checks.

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

Reason-code mapping for resolution outcomes:

- explicit deny -> `explicit-deny-permission-grant`
- owner override -> `owner-override`
- role grant -> `matched-role-grant`
- explicit allow permission grant -> `matched-permission-grant`
- sharing grant -> `matched-sharing-grant`
- workspace visibility -> `visibility-workspace-member`
- published visibility -> `visibility-published`
- default deny -> `no-effective-permission`

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

## Repository responsibilities and seams

- `IAuthorizationRoleGrantReadRepository`
  - authoritative source for role assignments + direct permission grants.
- `IAuthorizationResourcePolicyMetadataReadRepository`
  - authoritative source for owner/workspace/visibility/sharing-policy metadata.
- `IAuthorizationSharingGrantReadRepository`
  - authoritative source for explicit resource-sharing grants.
- `IAuthorizationPolicyDecisionEvaluator`
  - orchestration seam for runtime callers; callers should not duplicate repository reads + precedence logic.
- `EffectivePermissionResolutionService`
  - only location for effective permission precedence logic.
- `AuthorizedResourceQueryService`
  - only location for list/search authorization filtering pattern.

Do not re-implement precedence or visibility/share fallback in controllers, transport handlers, or feature services.

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
- cache-enabled memoization for role-assignment, sharing-grant, and resource-policy read hot paths
- cache invalidation on role assignment, sharing grant, and resource visibility/policy mutations
- cache-disabled behavior parity (optional cache usage)

## Caching and invalidation (Story 4.2.4)

- `SqliteAuthorizationPersistenceAdapter` now includes an optional in-memory cache (enabled by default) for:
  - `listRoleAssignments(...)`
  - `listSharingGrants(...)`
  - `findResourcePolicyMetadata(...)`
  - `listResourcePolicyMetadata(...)`
- Cache keys include workspace/resource locators, actor/subject filters, lifecycle filters (`asOf`, include flags), and paging fields.
- Invalidation is explicit and mutation-scoped:
  - role-assignment mutations clear role-assignment list cache,
  - sharing-grant mutations clear sharing-grant list cache,
  - resource-policy mutations evict the direct resource metadata cache key and clear resource-policy list cache.
- Cache capacity is bounded per store via `maxEntriesPerStore` to avoid unbounded memory growth.
- Cache usage is optional with adapter options:
  - `new SqliteAuthorizationPersistenceAdapter(path, { cache: { enabled: false } })`
- Cache is adapter-local in-memory only. There is no cross-process/distributed cache and no decision-result cache in evaluator services.

## Authorized list/search query pattern (Story 4.2.5)

- `AuthorizedResourceQueryService` is the reusable application seam for list/search surfaces that must exclude unauthorized resources.
- The service accepts actor context + workspace scope + required permission key and then:
  - loads workspace-scoped metadata candidates via `IAuthorizationResourcePolicyMetadataReadRepository.listResourcePolicyMetadata(...)`,
  - applies optional resource-family/resource-type/search filters,
  - evaluates allow/deny per candidate through `IAuthorizationPolicyDecisionEvaluator`,
  - supports owner/shared relation filters (`owner`, `shared`),
  - returns deterministic paged results.
- Resource modules should call this service first, then hydrate module-specific list rows only for authorized resource keys.

Integration example:

1. Run `listAuthorizedResources(...)` for workspace + permission (for example `asset.read`, `log.read`, `queue.read`).
2. Use the returned `{ resourceFamily, resourceType, resourceId }` tuples to query the module read model.
3. Preserve ordering/pagination from the authorized query result to keep deterministic UI behavior.

This prevents modules from leaking unauthorized rows and prevents each feature from inventing a different filtering strategy.

## Extension guidance

- Keep persistence access in repository ports and context-assembly use cases.
- Keep permission-composition logic in `EffectivePermissionResolutionService`.
- Treat precedence changes as policy-versioned changes, not incidental refactors.
- For a new resource family:
  - add permission keys in `AuthorizationPermissionCatalog`,
  - ensure role baselines in `AuthorizationRoleCatalog` if needed,
  - persist and expose metadata through resource-policy repositories,
  - reuse `AuthorizationPolicyDecisionEvaluator` / `AuthorizedResourceQueryService` rather than embedding checks in feature code.

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
- Event recorder failures are swallowed intentionally so authorization decisions and mutations are not blocked by telemetry transport issues.

## Authorization administration use cases (Story 4.2.7)

- Application commands now provide direct use-case seams for:
  - assign role,
  - remove role,
  - grant sharing access,
  - revoke sharing access,
  - update visibility (with sharing-grant reconciliation).
- Query use cases now provide:
  - permission evaluation (`EvaluateAuthorizationPermissionUseCase`),
  - effective-access listing (`ListAuthorizationEffectiveAccessUseCase`).
- All command/query boundaries validate payloads through Epic 4.1 schema parsers.
- Mutation commands enforce actor authorization before persistence writes:
  - workspace capability check (`system.manage`) for role administration,
  - resource-level share/manage checks (`<resource-family>.share|manage`) for sharing and visibility operations.
- Mutations remain coordinated through `AuthorizationPolicyMutationService`, preserving centralized repository + audit-event side effects.

Command gate examples:

- `AssignAuthorizationRoleUseCase` -> requires workspace capability `system.manage`.
- `GrantAuthorizationSharingAccessUseCase` -> requires `<resource-family>.share` and metadata/visibility consistency checks.
- `UpdateAuthorizationVisibilityUseCase` -> requires `<resource-family>.manage`, validates ownership-scope constraints, then reconciles sharing grants to submitted target state.

## Transport-facing sharing and visibility management (Story 4.4.1)

- `AuthorizationManagementBackendApi` now exposes transport-ready operations for:
  - visibility updates,
  - explicit sharing grant upsert,
  - explicit sharing grant revoke,
  - effective access state inspection.
- `IdentityHttpServer` now routes authorization management endpoints under `/api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/...`.
- Request payloads are validated at transport boundaries and again through Epic 4.1 shared schema parsing in command/query use cases.
- Error mapping remains stable across handlers:
  - `invalid-request` -> HTTP `400`
  - `forbidden` -> HTTP `403`
  - `not-found` -> HTTP `404`
  - `conflict` -> HTTP `409`
  - `internal` -> HTTP `500`

## Access review and effective-access inspection (Story 4.4.3)

- Effective-access inspection now supports a target actor that can differ from the requesting inspector:
  - request supports optional `inspectedActorUserIdentityId` (defaults to caller),
  - response includes both `inspectorActorUserIdentityId` and `inspectedActorUserIdentityId` for audit-safe traceability.
- `AuthorizationManagementBackendApi.readAccessState(...)` preserves resource-level inspector authorization (`<resource-family>.share|manage`) and evaluates policy for the inspected actor.
- Permission rows in access-state responses now include structured, redaction-safe explanation channels:
  - ownership context and owner-override contribution,
  - role-based grant contribution and matched role assignment ids,
  - direct permission-grant contribution and matched grant ids,
  - sharing-based grant contribution and matched sharing grant ids,
  - visibility contribution details (`resourceVisibility`, `sharingPolicyMode`, contribution reason when applicable).
- Coverage now verifies explanation accuracy for representative paths:
  - owner override,
  - explicit sharing allow,
  - visibility-based allow (`published`),
  - deny with no contributors.
- Transport and UI seams now pass and surface inspected-actor context:
  - `/access-state` accepts `inspectedActorUserIdentityId` query parameter,
  - renderer authorization client emits the parameter,
  - sharing-management UI can inspect another actor and renders contribution summaries per permission.
