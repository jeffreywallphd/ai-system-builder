# Feature 4 / Epic 4.3 Protected Resource Enforcement and Runtime Integration

Story 4.3.1 adds reusable transport authorization adapters so request handlers can consistently enforce centralized policy decisions across HTTP, WebSocket/stream, and IPC paths.

## Canonical files

- `src/infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `src/infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `src/infrastructure/transport/authorization/index.ts`
- `src/infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `src/infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter.ts`
- `src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- `src/infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`
- `src/ui/presenters/WorkspaceAdministrationCapabilitiesPresenter.ts`
- `src/infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `src/infrastructure/api/registry/RegistryBackendApi.ts`
- `src/infrastructure/api/studio-shell/tests/ReferenceImageOutputAuthorization.test.ts`
- `src/infrastructure/api/registry/tests/RegistryBackendApiAuthorization.test.ts`
- `src/infrastructure/api/studio-shell/tests/OperationalRunAuthorization.test.ts`
- `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- `src/infrastructure/api/system-runtime/tests/SystemRuntimeOperationalAuthorization.test.ts`
- `src/infrastructure/api/system-runtime/RuntimeRequestRouter.ts`
- `src/infrastructure/api/system-runtime/tests/RuntimeRequestRouter.test.ts`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/architecture/authorization-enforcement-integration-patterns.ai.md`

## Enforcement model

- `AuthorizationTransportPolicyGuard<TContext>` is the common guard.
- Handlers declare requirements, not raw permission logic:
  - resource-instance checks (`resourceFamily`, `resourceType`, `resourceId`)
  - workspace-capability checks (`workspaceId`, `capabilityResourceType`)
- One `resolveActor(...)` seam supplies actor context per transport surface.
- The guard delegates all policy evaluation to `IAuthorizationPolicyDecisionEvaluator`.

## Error mapping consistency

Normalized failure codes:

- `unauthorized` for missing actor identity context
- `forbidden` for policy deny outcomes
- `invalid-request` for malformed authorization context/targets
- `internal` for unexpected evaluation failures

Surface mapping:

- HTTP: `401`/`403`/`400`/`500`
- WebSocket/stream: `4401`/`4403`/`4400`/`1011`
- IPC: prefixed thrown errors (`unauthorized:...`, `forbidden:...`, `invalid-request:...`, `internal:...`)

## Test coverage

`AuthorizationTransportAdapters.test.ts` validates:

- allowed checks,
- denied checks,
- malformed context checks,
- workspace-capability checks,
- consistent mapping behavior across HTTP, WebSocket/stream, and IPC adapters.

Story 4.3.2 also enforces workspace administration mutation authorization:

- workspace membership and role mutations are policy-gated through centralized workspace-capability checks (`system.manage`) before use-case execution,
- workspace settings mutations (metadata update, lifecycle transition) and invitation cancel mutations share the same policy gate,
- unauthorized actors receive stable `forbidden` API responses while authorized admin flows continue to succeed.

Story 4.3.3 enforces protected asset/output reads before content or preview data is returned:

- `RegistryBackendApi.getAssetDetail(...)` now supports actor-aware policy checks (`asset.read`) against resource-instance targets before returning asset detail payloads.
- Reference-image output and dataset preview reads in `StudioShellBackendApi` are policy-gated (`asset.read`) using resource-instance targets bound to the managed reference-image dataset identity.
- Denied or missing actor contexts in these read paths return non-leaky `not-found` responses that match missing-resource behavior for the same endpoints.
- Output access checks are executed before output gallery item data is returned, preserving managed storage logical references and avoiding raw path authorization bypass patterns.

Story 4.3.3 test coverage validates:

- private owner access,
- workspace visibility access,
- explicit sharing access,
- denied callers receiving stable non-leaky not-found responses,
- registry asset detail authorization-deny parity with missing-asset behavior.

Story 4.3.4 enforces operational authorization on runs, queues, logs, and monitoring visibility:

- `StudioShellBackendApi` now policy-gates workflow run reads (`run.read`) and reference-image run-history reads (`run.read`) with actor-aware context and per-item list filtering.
- Workflow run list paths filter denied runs out of returned collections; per-run detail and rerun source lookups apply direct authorization checks before revealing run content.
- Reference-image run-history lists apply run-level authorization filtering against runtime-system-scoped run resource ids.
- `SystemRuntimeBackendApi` now enforces runtime operational policy checks:
  - run visibility checks (`run.read`) on status/result/session/poll operational paths,
  - queue visibility checks (`queue.read`) on recent execution queue listing,
  - log visibility checks (`log.read`) on execution trace and execution audit-trail retrieval.
- Runtime queue listing performs both top-level queue authorization and per-run filtering so partially visible queue pages do not leak denied run entries.

Story 4.3.4 test coverage validates:

- run access for owner, explicit-share collaborator, workspace admin, and denied actors,
- reference-image run-history filtering parity across owner/collaborator/admin/denied scenarios,
- runtime execution status/trace/audit authorization denies for unauthorized actors,
- runtime queue listing filtering behavior when callers can view queue metadata but only a subset of runs.

Story 4.3.5 adds centralized authorization-aware response redaction for protected reads:

- reusable response shaping utilities now support explicit `deny` vs `partial` vs `full` response modes so handlers can avoid binary expose-all behavior,
- partial visibility outcomes redact sensitive payload fields for protected read models (for example workflow run execution input/output payload details, reference-image run parameter snapshots/lineage source hints, and runtime trace/result sensitive fields),
- authorization integration preserves existing non-leaky deny behavior (`not-found`/`forbidden`) while allowing partial callers to receive safe metadata-level projections when policy allows existence without full content access.

Story 4.3.5 test coverage validates:

- redaction helper access-level classification for owner/share/role/visibility outcomes,
- deterministic remove/mask redaction path behavior,
- workflow run detail partial redaction for workspace-visibility role-based callers,
- runtime result/trace partial redaction for workspace-visibility operational callers.

Story 4.3.6 integrates authorization-driven capability loading for UI affordances:

- workspace administration API responses now expose explicit actor capability flags (`canManageWorkspaceSettings`, `canManageMembers`, `canManageInvitations`, `canManageRoles`) under `actorAccess.capabilities`.
- capability flags are derived by centralized policy evaluation (`system.manage` workspace-capability target) inside `WorkspaceAdministrationBackendApi`, reusing the same permission gate used for mutation enforcement.
- desktop and thin-client workspace administration pages now consume those flags through a centralized presenter (`presentWorkspaceAdministrationCapabilities(...)`) rather than embedding permission literals directly in page components.
- UI controls for settings, memberships, invitations, and roles are capability-driven for UX guidance while server authorization remains the authoritative enforcement point.

Story 4.3.6 test coverage validates:

- HTTP workspace admin responses include expected capability flags for allowed and denied actors,
- centralized UI capability derivation/fallback behavior via presenter tests,
- representative workspace admin and thin-client page wiring to centralized capability presentation.

Story 4.3.7 secures background and asynchronous execution paths with explicit authorization context semantics:

- `SystemRuntimeBackendApi` trusted-internal request handling now models explicit trusted internal actor semantics via `trustedInternalAuthorization`:
  - `propagate-caller` requires delegated caller context and enforces policy as that caller.
  - `system-action` requires explicit `systemActionId` when authorization policy evaluation is enabled.
- Trusted internal delegated user/service callers no longer implicitly bypass policy checks; bypass behavior is explicitly constrained to declared system actions.
- `RuntimeRequestRouter` now marks studio-shell internal runtime calls with explicit system-action semantics so internal automation is differentiated from user-delegated access.
- Deferred runtime flows (`startExecutionAsync`, `pollExecution`) preserve actor scoping when using delegated context, preventing privileged background processing from acting on behalf of users without explicit policy context.

Story 4.3.7 test coverage validates:

- delegated trusted-internal callers still receiving `forbidden` when policy denies access,
- explicit system-action requirement for trusted-internal bypass in authorization-enabled runtime contexts,
- async/deferred polling paths preserving delegated actor scope.

Story 4.3.8 documents the enforcement extension playbook for new runtime/resource surfaces:

- new docs codify canonical guard usage for HTTP/WebSocket/IPC routes so transport handlers do not embed ad hoc permission checks,
- resource-module integration rules now require stable protected-resource tuple contracts (`resourceFamily`/`resourceType`/`resourceId`) and deterministic non-leaky deny behavior where applicable,
- authorized query patterns now explicitly separate detail checks, list filtering, and queue-plus-item filtering expectations to avoid mixed visibility leakage,
- redaction guidance is centralized on `deriveAuthorizationResponseAccessLevel(...)` and `shapeAuthorizationAwareResponse(...)` so partial visibility does not expose sensitive fields,
- UI capability loading guidance now requires backend-derived `actorAccess.capabilities` and presenter-based consumption rather than page-local permission literals,
- async/trusted-internal runtime guidance now documents required `trustedInternalAuthorization` semantics (`propagate-caller` vs `system-action`) and delegated scope preservation expectations for deferred polling.
