# AI Companion: Feature 4 / Epic 4.3 Protected Resource Enforcement and Runtime Integration

## Purpose

Story 4.3.1 introduces reusable transport-layer authorization enforcement adapters so HTTP, WebSocket/stream, and IPC request paths can invoke the centralized policy engine without duplicating decision logic.

## Canonical files

- `infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `infrastructure/transport/authorization/index.ts`
- `infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `src/infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter.ts`
- `infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- `infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`
- `ui/presenters/WorkspaceAdministrationCapabilitiesPresenter.ts`
- `infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `infrastructure/api/registry/RegistryBackendApi.ts`
- `infrastructure/api/studio-shell/tests/ReferenceImageOutputAuthorization.test.ts`
- `infrastructure/api/registry/tests/RegistryBackendApiAuthorization.test.ts`
- `infrastructure/api/studio-shell/tests/OperationalRunAuthorization.test.ts`
- `infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- `infrastructure/api/system-runtime/tests/SystemRuntimeOperationalAuthorization.test.ts`
- `infrastructure/api/system-runtime/RuntimeRequestRouter.ts`
- `infrastructure/api/system-runtime/tests/RuntimeRequestRouter.test.ts`

## Transport enforcement model

- `AuthorizationTransportPolicyGuard<TContext>` is the reusable core guard.
- Handlers define declarative authorization requirements:
  - `resource-instance` target (`resourceFamily`, `resourceType`, `resourceId`)
  - `workspace-capability` target (`workspaceId`, `capabilityResourceType`)
- Actor context is supplied through a single per-surface resolver (`resolveActor(...)`), avoiding per-handler policy glue.
- The guard delegates evaluation to `IAuthorizationPolicyDecisionEvaluator`.

## Standardized failure mapping

The guard normalizes deny outcomes into transport-stable failure codes:

- `unauthorized`
  - missing actor identity context
- `forbidden`
  - policy denied due insufficient/effective permissions
- `invalid-request`
  - malformed/missing authorization target or invalid evaluation context
- `internal`
  - unexpected evaluation failure

Surface adapters keep the mapping consistent:

- HTTP adapter:
  - `401` -> `unauthorized`
  - `403` -> `forbidden`
  - `400` -> `invalid-request`
  - `500` -> `internal`
- WebSocket/stream adapter:
  - `4401` -> `unauthorized`
  - `4403` -> `forbidden`
  - `4400` -> `invalid-request`
  - `1011` -> `internal`
- IPC adapter:
  - throws prefixed errors (`unauthorized:...`, `forbidden:...`, `invalid-request:...`, `internal:...`)

## Handler usage posture

Handler boilerplate is intentionally minimal:

1. create one policy guard with context actor resolver,
2. declare per-route/operation requirement with permission + target,
3. call the surface adapter (`http`, `websocket`, or `ipc`) and short-circuit on denied result.

No handler reimplements policy precedence or role/share/visibility evaluation.

## Verification posture

`AuthorizationTransportAdapters.test.ts` covers:

- allowed resource-instance evaluation,
- denied policy outcome mapped to forbidden across all adapters,
- missing actor mapped to unauthorized,
- malformed target context mapped to invalid-request,
- workspace-capability evaluation path.

Story 4.3.2 additionally verifies workspace administration mutation gating:

- workspace membership and role mutation routes run a centralized policy decision check (`system.manage`) against a workspace-capability target before executing use cases,
- update/lifecycle/invitation-cancel mutations use the same gate,
- non-admin members receive stable `forbidden` API responses while owner/admin flows remain functional.

Story 4.3.3 adds protected asset/output read enforcement:

- registry asset detail reads (`RegistryBackendApi.getAssetDetail`) can now run centralized `asset.read` resource-instance checks before returning data.
- reference-image output/list/get dataset read flows in `StudioShellBackendApi` now run centralized `asset.read` resource-instance checks keyed to managed dataset resource identity.
- deny outcomes and missing actor contexts return stable `not-found` responses on these access flows so unauthorized callers cannot distinguish protected existence from missing resources.
- checks execute before output item payloads are returned, preserving storage-instance logical reference discipline in read paths.

Story 4.3.3 verification includes:

- private-owner allowed reads,
- workspace-visibility allowed reads,
- explicit-sharing allowed reads,
- denied/non-leaky parity checks for output reads,
- registry denied-vs-missing parity for asset detail reads.

Story 4.3.4 adds operational run/queue/log enforcement and monitoring visibility controls:

- `StudioShellBackendApi` now enforces `run.read` checks on workflow-run detail/rerun source reads and applies per-item run authorization filtering on workflow-run and reference-image run-history list responses.
- Reference-image run history uses runtime-system scoped run resource ids for policy targets, preserving workspace/owner/share visibility semantics in operational timeline views.
- `SystemRuntimeBackendApi` now composes authorization checks for operational resources:
  - `run.read` for execution status/result/session/poll visibility paths,
  - `queue.read` for recent execution queue list visibility,
  - `log.read` for execution trace and audit-trail retrieval paths.
- Queue list responses enforce both queue-level gate and per-run filtering to avoid denied run entry leakage.

Story 4.3.4 verification includes:

- owner/collaborator/admin/denied run visibility scenarios,
- list filtering + per-item authorization parity on workflow-run and reference-image run-history reads,
- denied runtime status/trace/audit access behavior for unauthorized actors,
- runtime queue list filtering when queue scope is visible but individual runs are not.

Story 4.3.5 introduces centralized authorization-aware response redaction:

- a reusable response-shaping utility now models `deny` vs `partial` vs `full` access outcomes for protected payloads,
- partial-access reads redact sensitive fields (workflow run execution input/output details, reference-image run parameter/lineage details, runtime trace/result sensitive sections) while preserving safe metadata visibility,
- deny outcomes continue to use non-leaky patterns (`not-found`/`forbidden`) and partial outcomes avoid policy-bypass content leakage.

Story 4.3.5 verification covers:

- access-level derivation across owner/share/role/visibility decisions,
- deterministic rule-based remove/mask redaction behavior,
- workflow run detail partial redaction for workspace visibility role access,
- runtime result/trace partial redaction for workspace visibility operational access.

Story 4.3.6 integrates authorization-aware capability loading for UI affordances:

- workspace administration API responses now include explicit actor capability flags (`canManageWorkspaceSettings`, `canManageMembers`, `canManageInvitations`, `canManageRoles`) under `actorAccess.capabilities`.
- capability flags are derived from centralized policy evaluation (`system.manage` workspace-capability target) in `WorkspaceAdministrationBackendApi`, reusing the same permission gate used for protected mutation operations.
- desktop/thin-client workspace administration surfaces consume these capability flags through a centralized presenter (`presentWorkspaceAdministrationCapabilities(...)`) rather than embedding permission literals directly in page components.
- UI affordances (settings edits, membership updates, invitation actions, role actions) are shown/enabled from capability flags while server-side policy enforcement remains authoritative.

Story 4.3.6 verification covers:

- workspace admin HTTP responses returning capability flags for authorized and unauthorized actors,
- centralized UI capability derivation/fallback behavior in presenter tests,
- representative workspace admin/thin-client pages wired to centralized capability presentation instead of page-local permission literals.

Story 4.3.7 protects background and asynchronous runtime execution paths with explicit authorization context semantics:

- `SystemRuntimeBackendApi` trusted-internal requests now distinguish actor semantics through `trustedInternalAuthorization`:
  - `propagate-caller` requires explicit delegated caller context and evaluates policy with that actor.
  - `system-action` requires explicit `systemActionId` when authorization policy evaluation is active.
- Trusted internal requests no longer implicitly bypass policy for delegated user/service callers; bypass is limited to explicit system actions.
- `RuntimeRequestRouter` now emits explicit trusted-internal system-action semantics for studio-shell internal runtime routing.
- Asynchronous/deferred runtime flows (`startExecutionAsync` + `pollExecution`) now preserve delegated actor scope when callers choose `propagate-caller`, preventing privileged server-side background processing from silently operating as an implicit superuser.

Story 4.3.7 verification covers:

- trusted internal delegated-caller requests still receiving `forbidden` when policy denies actor access,
- trusted internal system-action bypass requiring explicit `systemActionId` when authorization is active,
- async/deferred polling paths honoring delegated actor scope instead of implicit privileged bypass.
