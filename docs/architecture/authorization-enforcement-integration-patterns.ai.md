# AI Companion: Authorization Enforcement Integration Patterns

## Purpose

Use this guide when adding new protected routes, handlers, resource modules, UI affordances, or async runtime surfaces.

Goal: prevent bypasses and keep all policy checks centralized.

## Canonical integration files

- `infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `infrastructure/api/registry/RegistryBackendApi.ts`
- `infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- `infrastructure/api/system-runtime/RuntimeRequestRouter.ts`
- `infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- `src/application/authorization/use-cases/AuthorizationResponseRedaction.ts`
- `ui/presenters/WorkspaceAdministrationCapabilitiesPresenter.ts`

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

- `infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `infrastructure/api/studio-shell/tests/OperationalRunAuthorization.test.ts`
- `infrastructure/api/system-runtime/tests/SystemRuntimeOperationalAuthorization.test.ts`
- `infrastructure/api/studio-shell/tests/ReferenceImageOutputAuthorization.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`
