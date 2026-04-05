# Authorization Enforcement Integration Patterns

Story 4.3.8 documents the canonical integration patterns for new protected routes, handlers, resource modules, and UI surfaces.

Use this file when adding any new read/write/download/operational capability that touches protected resources.

## Canonical files

- `infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `infrastructure/api/registry/RegistryBackendApi.ts`
- `infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- `infrastructure/api/system-runtime/RuntimeRequestRouter.ts`
- `infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- `src/application/authorization/use-cases/AuthorizationResponseRedaction.ts`
- `ui/presenters/WorkspaceAdministrationCapabilitiesPresenter.ts`
- `infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `infrastructure/api/studio-shell/tests/ReferenceImageOutputAuthorization.test.ts`
- `infrastructure/api/studio-shell/tests/OperationalRunAuthorization.test.ts`
- `infrastructure/api/system-runtime/tests/SystemRuntimeOperationalAuthorization.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`

## 1) Route and transport guard pattern

For HTTP/WebSocket/IPC entry points, enforce authorization through the shared transport guard and adapters, not route-local permission logic.

Required shape:

- resolve actor once per transport context (`resolveActor`)
- declare `requiredPermissionKey`
- declare `target.kind` as `resource-instance` or `workspace-capability`
- map failures through adapters (`HttpAuthorizationGuardAdapter`, `WebSocketAuthorizationGuardAdapter`, `IpcAuthorizationGuardAdapter`)

Use this pattern from `AuthorizationTransportPolicyGuard`:

```ts
const guard = new AuthorizationTransportPolicyGuard<RequestContext>({
  decisionEvaluator,
  resolveActor: (context) => ({
    actorUserIdentityId: context.actorUserIdentityId,
    activeWorkspaceId: context.workspaceId,
    authenticatedAt: context.authenticatedAt,
  }),
});

const result = await new HttpAuthorizationGuardAdapter(guard).authorize(context, {
  requiredPermissionKey: "asset.read",
  target: {
    kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
    resourceFamily: AuthorizationResourceFamilies.asset,
    resourceType: "registry-asset",
    resourceId: (ctx) => ctx.assetId,
  },
});
```

Failure mapping is centralized and must remain stable:

- `unauthorized` -> HTTP `401`, WebSocket `4401`, IPC `unauthorized:*`
- `forbidden` -> HTTP `403`, WebSocket `4403`, IPC `forbidden:*`
- `invalid-request` -> HTTP `400`, WebSocket `4400`, IPC `invalid-request:*`
- `internal` -> HTTP `500`, WebSocket `1011`, IPC `internal:*`

## 2) Protected resource contract pattern

Every protected module must keep one stable resource tuple:

- `resourceFamily`
- `resourceType`
- `resourceId`

Rules:

- Build `resourceId` deterministically from module identity (for example `systemId::datasetBindingId` in reference-image reads).
- Keep `resourceType` stable over time. If it changes, migrate metadata and tests together.
- Use evaluator targets directly (`AuthorizationPolicyEvaluationTargetKinds.resourceInstance` or `workspaceCapability`) instead of ad hoc role checks.

Examples in production code:

- registry asset detail: `asset.read` on `asset / registry-asset / <assetId>`
- workflow run detail: `run.read` on `run / workflow-run / <runId>`
- runtime queue/trace/audit: `queue.read` and `log.read` on runtime resource types
- workspace admin mutations: `system.manage` with workspace-capability target (`workspaceId`, `capabilityResourceType`)

## 3) Authorized query patterns

### Detail read

- Resolve candidate record.
- Evaluate authorization against canonical protected resource tuple.
- On deny, return the same response shape used for missing resources when the surface is non-leaky.

Current non-leaky detail behavior:

- `RegistryBackendApi.getAssetDetail(...)` denies with `not-found`.
- `StudioShellBackendApi` reference-image dataset/output and workflow run detail denies with `not-found`.

### List read

- Retrieve candidate list with normal business filters.
- Apply per-item authorization checks before returning.
- Return only authorized items (do not include denied placeholders).

Current examples:

- workflow run list filtering in `StudioShellBackendApi.listWorkflowRuns(...)`
- reference-image run-history filtering in `StudioShellBackendApi.listReferenceImageRunHistory(...)`
- runtime queue list: queue-level gate plus per-run filtering in `SystemRuntimeBackendApi`

## 4) Redaction pattern for partial access

For protected reads that allow partial visibility, use:

- `deriveAuthorizationResponseAccessLevel(...)`
- `shapeAuthorizationAwareResponse(...)`

Never hand-roll field deletion in route handlers.

Pattern:

- compute decision -> access level (`deny` / `partial` / `full`)
- for `deny`, return non-leaky error
- for `partial`, apply explicit redaction rules by path
- for `full`, return original payload

Current runtime redaction examples:

- result redaction rules remove `output`, `diagnostics`, and serialized output diagnostics fields
- trace redaction rules remove `trace.events` and `trace.logs`

Current studio-shell redaction examples:

- workflow run detail partial redaction removes sensitive execution input/output detail fields for workspace-visibility access

## 5) UI capability loading pattern

UI must not derive authority from hard-coded permission strings.

Required flow:

1. Backend derives capability flags from centralized policy checks.
2. API returns flags under `actorAccess.capabilities`.
3. UI consumes flags through presenter helper (`presentWorkspaceAdministrationCapabilities(...)`).
4. UI uses flags for affordance visibility/disabled state only.
5. Server remains authoritative and still enforces all mutations.

Reference behavior:

- `WorkspaceAdministrationBackendApi.withActorAccessCapabilities(...)` evaluates `system.manage` workspace capability.
- presenter fallback is `actorAccess.canAdministrate` when capability flags are absent.

## 6) Async and trusted-internal authorization pattern

Runtime async/background flows must carry explicit authorization semantics.

Use `RuntimeApiRequestContext.trustedInternalAuthorization`:

- `actorMode: "propagate-caller"`:
  - delegated user/service context is required
  - policy evaluates as delegated caller
- `actorMode: "system-action"`:
  - explicit `systemActionId` is required when policy evaluator is active
  - represented as trusted internal system caller

`RuntimeRequestRouter` sets system-action context for studio-shell internal routing with:

- `trustedInternal: true`
- `trustedInternalAuthorization.actorMode: "system-action"`
- `trustedInternalAuthorization.systemActionId: "studio-shell-internal-router"`

`startExecutionAsync(...)` + `pollExecution(...)` must preserve delegated actor scope when using `propagate-caller`.

## 7) Anti-patterns to reject in review

- route-local role checks replacing policy evaluator calls
- permission literals copied into page components for authority decisions
- returning denied items in list payloads
- exposing different error text/status for missing vs unauthorized on non-leaky reads
- bypassing redaction helpers for partial-access responses
- trusted internal requests without `trustedInternalAuthorization` semantics
- changing `resourceType`/`resourceId` format without metadata/test updates

## 8) Minimum verification for new protected surfaces

When you add a new protected route/module, add tests that cover:

- allowed access path
- denied path
- missing/invalid actor context path
- list filtering (if list endpoint)
- partial redaction (if partial visibility exists)
- async delegated scope preservation (if async/trusted-internal path)

Use existing suites as templates:

- `AuthorizationTransportAdapters.test.ts`
- `OperationalRunAuthorization.test.ts`
- `SystemRuntimeOperationalAuthorization.test.ts`
- `ReferenceImageOutputAuthorization.test.ts`
- `IdentityHttpServerWorkspaceAdministration.test.ts`
