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
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`
- `infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `infrastructure/api/registry/RegistryBackendApi.ts`
- `infrastructure/api/studio-shell/tests/ReferenceImageOutputAuthorization.test.ts`
- `infrastructure/api/registry/tests/RegistryBackendApiAuthorization.test.ts`

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
