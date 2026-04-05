# AI Companion: Feature 4 / Epic 4.2 Policy Evaluation and Authorization Persistence

## Purpose

Stories 4.2.2-4.2.3 deliver the production policy-evaluation core for Feature 4:

- `EffectivePermissionResolutionService` provides deterministic allow/deny precedence.
- `AuthorizationPolicyDecisionEvaluator` composes actor grants + resource metadata and emits typed decisions for resource-instance and workspace-capability checks.

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

`EffectivePermissionResolutionService` remains reusable in two ways:

- policy-evaluator seam: implements `IAuthorizationPolicyEvaluator` for API enforcement paths.
- capability seam: exposes `resolvePermissions(...)` for batch UI capability checks.

Both paths consume the same actor/resource context contract and use identical precedence.

Story 4.2.3 adds `AuthorizationPolicyDecisionEvaluator` as the caller-facing evaluator seam:

- accepts actor + permission + target (`resource-instance` or `workspace-capability`),
- loads role/grant state and resource metadata for resource-instance checks,
- reuses effective-permission precedence for the final allow/deny decision,
- returns typed decision envelopes with stable denial reasons and optional redaction-safe debug details.

## Request-to-decision path

Use this sequence to trace one authorization decision from request to outcome:

1. Entry seam selection:
   - `EvaluateAuthorizationPolicyUseCase` for direct resource-instance requests.
   - `AuthorizationPolicyDecisionEvaluator` for actor + permission + target (`resource-instance` or `workspace-capability`).
2. Validate actor identity context (`actorUserIdentityId` or `actorServiceId`).
3. Normalize permission key (`createPermissionKey(...)`); invalid keys return deterministic deny/failure.
4. Load actor role/permission snapshot (`IAuthorizationRoleGrantReadRepository`).
5. Resource-instance target:
   - read resource policy metadata (`findResourcePolicyMetadata(...)`),
   - read sharing grants (`listSharingGrants(...)`),
   - build domain actor/resource contexts.
6. Workspace-capability target:
   - synthesize private workspace-capability resource context,
   - no resource metadata or sharing-grant read required.
7. Delegate resolution to `EffectivePermissionResolutionService.resolvePermission(...)`.
8. Return typed allow/deny decision with stable reason/denial mapping.
9. Emit best-effort audit-safe decision events (`evaluated` always; `denied` for deny outcomes).

`resource-policy-metadata-not-found` remains deterministic deny behavior for resource-instance checks.

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

Resolution reason-code mapping:

- explicit deny -> `explicit-deny-permission-grant`
- owner override -> `owner-override`
- role baseline grant -> `matched-role-grant`
- explicit allow permission grant -> `matched-permission-grant`
- sharing grant -> `matched-sharing-grant`
- workspace visibility -> `visibility-workspace-member`
- published visibility -> `visibility-published`
- default deny -> `no-effective-permission`

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

## Repository responsibility map

- `IAuthorizationRoleGrantReadRepository`
  - authoritative source for role assignments and direct permission grants.
- `IAuthorizationResourcePolicyMetadataReadRepository`
  - authoritative source for ownership/workspace/visibility/sharing-policy metadata.
- `IAuthorizationSharingGrantReadRepository`
  - authoritative source for explicit resource-sharing grants.
- `IAuthorizationPolicyDecisionEvaluator`
  - runtime orchestration seam to avoid duplicated loading + policy composition in callers.
- `EffectivePermissionResolutionService`
  - single precedence-resolution implementation.
- `AuthorizedResourceQueryService`
  - single authorization-filtered list/search composition seam.

Guardrail: do not duplicate precedence and fallback rules in controllers, transport handlers, or feature-specific services.

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
- Cache scope is adapter-local in-memory only; there is no distributed cache and no decision-result memoization in evaluator services.

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

This pattern prevents unauthorized row leakage and prevents per-feature ad hoc authorization filtering.

## Extension guidance

- Keep context loading in repository-backed use cases (`EvaluateAuthorizationPolicyUseCase`) and keep resolution logic inside the resolver service.
- Preserve precedence ordering unless a versioned authorization policy story explicitly changes it.
- Add new role keys via role catalog contracts before expecting role-baseline grants in this resolver.
- For new resource families: add permission catalog keys, update role baselines as needed, persist resource policy metadata, and reuse evaluator/list-query seams rather than embedding custom checks.

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
- Recorder failures are intentionally swallowed so authorization decisions/mutations are not blocked by telemetry transport failures.

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

Mutation gate examples:

- `AssignAuthorizationRoleUseCase` -> requires workspace capability `system.manage`.
- `GrantAuthorizationSharingAccessUseCase` -> requires `<resource-family>.share` and metadata/visibility consistency checks.
- `UpdateAuthorizationVisibilityUseCase` -> requires `<resource-family>.manage`, enforces ownership-scope visibility constraints, and reconciles sharing grants to submitted state.

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

- Effective-access reads now support authorized inspection of a target actor distinct from the requesting inspector:
  - request adds optional `inspectedActorUserIdentityId` (defaults to the requesting actor).
  - response echoes both `inspectorActorUserIdentityId` and `inspectedActorUserIdentityId`.
- `AuthorizationManagementBackendApi.readAccessState(...)` keeps the existing inspector authorization gate (`<resource-family>.share|manage`) and evaluates effective permissions for the inspected actor.
- Effective-access permission records now include a redaction-safe explanation envelope per permission, with explicit contribution channels:
  - ownership context (`isResourceOwner`, whether owner override contributed),
  - role-based grant contribution + matched role assignment ids,
  - direct permission-grant contribution + matched permission grant ids,
  - sharing-based grant contribution + matched sharing grant ids,
  - visibility contribution (`resourceVisibility`, `sharingPolicyMode`, contribution flag, contribution reason code when visibility matched).
- Story verification coverage includes representative explanation accuracy scenarios:
  - owner-override contribution,
  - explicit sharing contribution,
  - published-visibility contribution,
  - deny path with no contributing channels.
- Transport and client seams now pass inspection target context end-to-end:
  - HTTP query parameter `inspectedActorUserIdentityId` on `/access-state`,
  - renderer HTTP client support,
  - sharing management UI display of inspected actor context and per-permission contribution summaries.

## High-risk sharing and visibility safeguards (Story 4.4.5)

- Authorization administration mutations now include server-side safeguards for irreversible or high-risk access changes:
  - broadening visibility exposure (`private -> shared/workspace`, `shared -> workspace`, any transition to `published`),
  - enabling resource resharing (`allowResharing: false -> true`),
  - creating or widening broad-subject sharing grants (`workspace`, `workspace-role`, `public`),
  - adding elevated sharing permission actions (for example `.manage`, `.share`, `.update`, `.delete`, `.execute`, `.publish`),
  - removing the last active workspace administrator assignment (`owner|admin` continuity check).
- Risk checks execute in application use-case logic (`GrantAuthorizationSharingAccessUseCase`, `UpdateAuthorizationVisibilityUseCase`, `RemoveAuthorizationRoleUseCase`) so enforcement is not dependent on UI confirmation prompts.
- For confirmable high-risk mutations, callers must include explicit confirmation metadata:
  - `metadata.authorizationHighRiskConfirmation.confirmedRiskCodes: string[]`
  - all detected risk codes for the mutation must be acknowledged before write execution.
- Missing acknowledgements return deterministic administration failure code:
  - `authorization-administration-high-risk-confirmation-required`
  - mapped to transport `conflict` responses for authorization-management endpoints.
- Administrative continuity protection for role removal is a hard guardrail, not a confirmable prompt:
  - revoking an `admin` role is rejected when it would leave zero active `owner|admin` assignments in the workspace.

## Authorization and sharing reporting read model (Story 4.4.6)

- `AuthorizationManagementBackendApi` now exposes a workspace-scoped reporting query:
  - `readWorkspaceSharingReport(...)`
  - returns role-assignment posture, visibility distribution, unusual visibility/policy pattern flags, and recent sharing mutations.
- Reporting queries are policy-protected through workspace-capability enforcement:
  - requires `system.manage` on workspace capability target kind before data is returned.
- `IdentityHttpServer` now exposes a read-only reporting endpoint:
  - `GET /api/v1/authorization/reporting/workspaces/:workspaceId`
  - optional query fields: `asOf`, `includeRevokedRoleAssignments`, `includeRevokedSharingGrants`, `recentSharingMutationsLimit`.
- Reporting data uses authoritative persistence repositories:
  - workspace-scoped role assignments from authorization role-assignment persistence,
  - workspace-scoped resource policy metadata for visibility posture,
  - workspace-scoped sharing grants for mutation review and unusual pattern detection.
- Unusual visibility/policy pattern flags currently include:
  - private resources with active sharing grants,
  - owner-only sharing policy with active sharing grants,
  - published visibility without `publishedAt`.

## End-to-end authorization/sharing integration hardening (Story 4.4.7)

- Integration coverage now includes full authorization precedence lifecycle scenarios that cross persistence, policy evaluation, application APIs, HTTP transport, and UI route/page seams.
- Backend API integration tests now verify a deterministic lifecycle for a workspace resource:
  - baseline allow from workspace visibility,
  - narrowing visibility to private + owner-only and confirming deny,
  - explicit sharing grant restore of access,
  - grant revoke restoring deny,
  - reporting read model surfacing resulting mutation history.
- HTTP server integration tests now verify the same lifecycle over transport contracts:
  - authenticated owner mutation success,
  - non-admin mutation attempts denied with stable `403` responses,
  - access-state reads reflecting visibility/share precedence changes,
  - reporting endpoint returning revoked sharing mutation evidence for audit review.
- UI page integration tests now verify authenticated desktop/thin-client sharing management surfaces render stable operational affordances and route handoff links without coupling to incidental DOM structure.
- These scenarios are designed to catch regressions in:
  - effective-permission precedence (visibility vs explicit sharing),
  - mutation enforcement and denial semantics,
  - transport contract stability for management/reporting flows,
  - desktop/thin-client sharing surface wiring integrity.

## Feature-level documentation publication and implementation notes (Story 4.4.8)

- Story 4.4.8 finalizes Feature 4 as a production-ready subsystem baseline and publishes durable extension documentation for future epics.
- New feature baseline reference:
  - `docs/architecture/authorization-feature-4-final-baseline.md`
- New admin/user operations guide:
  - `docs/authorization-sharing-management-and-access-review.md`
- The final baseline consolidates:
  - authoritative policy concepts and precedence,
  - delivered API and route surfaces for sharing/access-review/reporting,
  - UI management flows across desktop and thin-client settings surfaces,
  - high-risk safeguard contracts and governance posture,
  - extension patterns for new resource families and role evolution.
- This closes the Epic 4.4 documentation handoff so future contributors can extend authorization behavior without reconstructing assumptions from tests or endpoint handlers.
