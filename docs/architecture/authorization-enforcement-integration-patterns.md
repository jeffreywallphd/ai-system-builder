# Authorization Enforcement Integration Patterns

Story 4.3.8 documents the canonical integration patterns for new protected routes, handlers, resource modules, and UI surfaces.

Use this file when adding any new read/write/download/operational capability that touches protected resources.

## Canonical files

- `src/infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `src/infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `src/infrastructure/api/registry/RegistryBackendApi.ts`
- `src/infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- `src/infrastructure/api/system-runtime/RuntimeRequestRouter.ts`
- `src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- `src/infrastructure/api/authorization/AuthorizationManagementBackendApi.ts`
- `src/application/authorization/use-cases/AuthorizationResponseRedaction.ts`
- `src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts`
- `src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter.ts`
- `src/ui/presenters/WorkspaceAdministrationCapabilitiesPresenter.ts`
- `src/infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `src/infrastructure/api/studio-shell/tests/ReferenceImageOutputAuthorization.test.ts`
- `src/infrastructure/api/studio-shell/tests/OperationalRunAuthorization.test.ts`
- `src/infrastructure/api/system-runtime/tests/SystemRuntimeOperationalAuthorization.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthorizationManagement.test.ts`

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

## 8.1) Runtime context-drift regression baseline (Story 1.3.2)

When authorization behavior is refactored across route handlers, policy evaluators, and persistence adapters, keep one composed-runtime regression suite that explicitly covers:

- actor active-workspace mismatch versus target/resource workspace,
- resource workspace mismatch versus caller-provided target workspace,
- synthesized workspace-role fallback scope mismatch (must not authorize),
- read/list allowed while create/write remains denied for the same actor/resource context,
- workspace-capability denial when role scope exists only in a different workspace.

Canonical regression suite:

- `src/application/authorization/tests/AuthorizationRuntimeContextDriftRegression.test.ts`

## 9) Sharing management and reporting surfaces (Story 4.4.8 publication)

Use these seams when adding new admin/user sharing capabilities:

- backend API composition: `AuthorizationManagementBackendApi`
- HTTP routing and request validation: `IdentityHttpServer` authorization management handlers
- renderer service/client seams: `AuthorizationManagementService`, `HttpAuthorizationManagementClient`
- desktop/thin-client route builders: `src/ui/web/authorization/AuthorizationSharingRoutes.ts`
- shared management panel composition: `AuthorizationSharingManagementPanel`
- reporting surface: `AuthorizationReportingPage`

Required extension posture:

- keep endpoint and error contracts stable (`invalid-request`, `forbidden`, `conflict`, etc.),
- keep high-risk mutation confirmations server-enforced through metadata confirmation codes,
- keep access review/reporting policy-gated in backend APIs,
- update docs + tests together when adding resource-family support to sharing/reporting surfaces.

Reference docs:

- `docs/architecture/authorization-feature-4-final-baseline.md`
- `docs/authorization-sharing-management-and-access-review.md`

## 10) Canonical authorization diagnostic contract (Story 2.1.1)

Use `createAuthorizationDiagnosticRecord(...)` from
`src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts`
for machine-readable denial and cross-layer failure provenance.

Field expectations by lifecycle stage:

- Always required:
  - `correlation.requestId` or `correlation.correlationId`
  - `target.kind`
  - `reasonCode`
  - `denialProvenanceStage`
- Required when applicable:
  - `target.targetIdentifier` for `target.kind="resource-instance"`
  - `target.targetWorkspaceId` for `target.kind="workspace-capability"`
  - `requiredPermissionKey` once permission resolution is attempted (`use-case`, `evaluator`, `adapter` stages)
  - `runtimeAvailability` metadata when denial is affected by readiness/dependency state
- Optional but strongly recommended for evaluator/use-case diagnostics:
  - `actor.actorIdentityId`
  - `actor.actorActiveWorkspaceId`
  - `counts.roleAssignmentCount`
  - `counts.permissionGrantCount`
  - `counts.sharingGrantCount`
  - `counts.sharingPolicyMetadataCount`
  - `counts.applicableScopeCount`
  - `matchedSourceKind`

Extension rules:

- Put story/team-specific metadata under `extensions`.
- Use namespaced extension keys (for example `team.feature`) so new fields do not collide with the canonical schema.
- Do not replace canonical fields with extension-only equivalents; extensions are additive.

## Related ADRs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`
