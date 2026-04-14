# AI Companion: Authorization Enforcement Integration Patterns

## Purpose

Use this guide when adding new protected routes, handlers, resource modules, UI affordances, or async runtime surfaces.

Goal: prevent bypasses and keep all policy checks centralized.

## Canonical integration files

- `src/infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `src/infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `src/infrastructure/api/registry/RegistryBackendApi.ts`
- `src/infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- `src/infrastructure/api/system-runtime/RuntimeRequestRouter.ts`
- `src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- `src/infrastructure/api/authorization/AuthorizationManagementBackendApi.ts`
- `src/application/authorization/use-cases/AuthorizationResponseRedaction.ts`
- `src/shared/contracts/authorization/AuthorizationDiagnosticCatalogs.ts`
- `src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts`
- `src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter.ts`
- `src/ui/presenters/WorkspaceAdministrationCapabilitiesPresenter.ts`

## Required enforcement patterns

### 1) Transport routes

- Use `AuthorizationTransportPolicyGuard` + transport adapters.
- Do not write route-local permission logic.
- Require target kinds:
  - `resource-instance` (`resourceFamily`, `resourceType`, `resourceId`)
  - `workspace-capability` (`workspaceId`, `capabilityResourceType`)
- Keep failure mapping stable:
  - `unauthorized` -> 401/4401
  - `forbidden` -> 403/4403
  - `invalid-request` -> 400/4400
  - `internal` -> 500/1011

### 2) Resource tuple contract

Every protected module must define a stable tuple:

- `resourceFamily`
- `resourceType`
- `resourceId`

Keep IDs deterministic and keep `resourceType` stable across releases.

### 3) Authorized query shape

- Detail reads: resolve candidate -> evaluate -> deny with non-leaky behavior when required.
- List reads: fetch candidates -> per-item evaluate -> return only allowed items.
- Runtime queue path: top-level queue gate plus per-run filtering.

### 4) Partial-access redaction

Use only:

- `deriveAuthorizationResponseAccessLevel(...)`
- `shapeAuthorizationAwareResponse(...)`

No ad hoc field deletion in handlers.

### 5) UI capabilities

- Backend computes capabilities from centralized policy (`system.manage` for workspace admin).
- API returns `actorAccess.capabilities`.
- UI uses `presentWorkspaceAdministrationCapabilities(...)`.
- UI flags guide affordances; backend mutation checks remain authoritative.

### 6) Async/trusted-internal runtime semantics

Use explicit `trustedInternalAuthorization`:

- `propagate-caller`: requires delegated caller context, evaluates policy as that caller.
- `system-action`: requires explicit `systemActionId` when evaluator is active.

`RuntimeRequestRouter` internal routing already sets:

- `trustedInternal: true`
- `actorMode: system-action`
- `systemActionId: studio-shell-internal-router`

Async flows (`startExecutionAsync`, `pollExecution`) must preserve delegated scope when `propagate-caller` is used.

## Review rejects

- route-local role checks
- UI permission literals as authority source
- denied items returned in list payloads
- missing-vs-unauthorized leakage on non-leaky reads
- ad hoc redaction logic
- trusted internal calls without explicit authorization semantics

## Test templates to copy

- `src/infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `src/infrastructure/api/studio-shell/tests/OperationalRunAuthorization.test.ts`
- `src/infrastructure/api/system-runtime/tests/SystemRuntimeOperationalAuthorization.test.ts`
- `src/infrastructure/api/studio-shell/tests/ReferenceImageOutputAuthorization.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthorizationManagement.test.ts`

## Runtime context-drift regression baseline (Story 1.3.2)

Keep one composed-runtime regression suite that targets cross-layer drift risks:

- actor active workspace differs from target/resource workspace,
- resource workspace differs from caller-provided target workspace,
- synthesized workspace-role fallback does not authorize across wrong scope,
- read/list remains allowed while create/write remains denied for same actor/resource context,
- workspace-capability checks are denied when role scope exists only in another workspace.

Canonical suite:

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

## 10) Canonical authorization diagnostics (Stories 2.1.1 + 2.1.2)

Use `createAuthorizationDiagnosticRecord(...)` from
`src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts` as the shared machine-readable schema for authorization denials and cross-layer failure provenance.

Use `src/shared/contracts/authorization/AuthorizationDiagnosticCatalogs.ts` as the stable source for reason-code and provenance-stage values.

Reason-code catalogs:

- `AuthorizationDecisionReasonCodes`: evaluator/use-case decision outcomes (`matched-role-grant`, `visibility-published`, `no-effective-permission`, `scope-mismatch`).
- `AuthorizationDecisionDenialReasonCodes`: denial-focused subset for policy-deny interpretation and safe mapping.
- `AuthorizationRuntimeAvailabilityReasonCodes`: unavailable/degraded intersection with runtime readiness (`runtime-gate-blocked`, `runtime-degraded`, blocking dependency reason codes).
- `AuthorizationTransportMappingReasonCodes`: boundary mapping outcomes (`transport-denied`, `transport-mapping-failed`, `permission-entry-missing`).
- `AuthorizationDiagnosticReasonCodes`: consolidated machine-readable catalog for diagnostic `reasonCode`.

Provenance-stage catalog:

- Use `AuthorizationDiagnosticProvenanceStages` for stable stage attribution across layers.
- Route/API boundary stages: `route`, `api`, `transport-mapping`.
- Evaluation pipeline stages: `actor-snapshot`, `permission-snapshot`, `scope-filtering`, `evaluator-resolution`, `final-decision-emission`.
- Cross-layer failure stages: `adapter-failure`, `runtime-readiness`, `use-case`, `adapter`.

Required fields:

- `correlation.requestId` or `correlation.correlationId`
- `target.kind`
- `reasonCode`
- `denialProvenanceStage`

Required when applicable:

- `target.targetIdentifier` for `target.kind="resource-instance"`
- `target.targetWorkspaceId` for `target.kind="workspace-capability"`
- `requiredPermissionKey` once permission evaluation is attempted (`use-case`, `evaluator`, `adapter`)
- `runtimeAvailability` diagnostics when readiness/dependency state affects authorization behavior

Optional (recommended once evaluation context is available):

- `actor.actorIdentityId`
- `actor.actorActiveWorkspaceId`
- `counts.roleAssignmentCount`
- `counts.permissionGrantCount`
- `counts.sharingGrantCount`
- `counts.sharingPolicyMetadataCount`
- `counts.applicableScopeCount`
- `matchedSourceKind`

Extension rules:

- Use `extensions` for story/team-specific metadata only.
- Keep extension keys namespaced (for example `team.feature`) to avoid collisions.
- Treat extensions as additive; canonical fields remain the shared contract authority.

## 11) Emission completeness and redaction boundaries (Story 2.1.3)

Use `createAuthorizationDiagnosticRecord(...)` and `projectAuthorizationDiagnosticRecord(...)` from
`src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts` as the canonical emission policy.

Outcome completeness rules:

- `allow` and `deny` diagnostics must include `requiredPermissionKey`.
- `allow` diagnostics must include `matchedSourceKind` that identifies an effective source (`owner-override`, `role-grant`, `permission-grant`, `sharing-grant`, or `visibility-rule`).
- `deny` diagnostics must include `matchedSourceKind` (`none` is valid when nothing matched).
- `unavailable` and `degraded` diagnostics must include `runtimeAvailability` with `affectedByRuntimeAvailability=true`.
- Evaluator/use-case/final-decision stages must emit role/permission/sharing evidence by either:
  - counts and/or identifier arrays, or
  - explicit `evidence.missing` markers (for example `role-assignments-unavailable`) when upstream data is unavailable.

Counts vs IDs emission rules:

- Internal diagnostics may include identifier evidence (`evidence.roleAssignmentIds`, `evidence.permissionGrantIds`, `evidence.sharingGrantIds`) and are clamp-limited by policy options.
- External/user-facing diagnostics must not include identifier evidence; emit counts only.
- Missing intermediate data must be represented explicitly via `evidence.missing` rather than omitted silently.

Redaction and sensitive boundary rules:

- Runtime availability `detail` and extension values are sanitized for secret/path/token-like payloads.
- External projection removes actor identity/workspace identifiers and target identifiers.
- For admin-sensitive or secret-sensitive surfaces, external projection also removes `requiredPermissionKey`, sensitive target metadata, and extensions.
- External extensions are opt-in and only retained when key suffix indicates public exposure (`.public` or `:public`), with value sanitization applied.

Internal vs external surfaces:

- `internal`: operational diagnostics for logs/telemetry/reconciliation paths; can include bounded identifier evidence.
- `external`: response-safe payloads for clients/users; least-information posture by default.

Contributor guidance:

- Do not emit raw policy internals, secrets, credential material, or unbounded IDs in external responses.
- Prefer canonical reason codes/provenance stages and explicit missing-evidence markers over ad hoc strings.
- Keep deny-by-default behavior: when upstream evaluation evidence is missing, emit a deny/unavailable diagnostic with explicit missing markers.

## Related ADRs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`
