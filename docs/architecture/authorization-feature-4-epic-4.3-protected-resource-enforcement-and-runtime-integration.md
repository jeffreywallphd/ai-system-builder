# Feature 4 / Epic 4.3 Protected Resource Enforcement and Runtime Integration

Story 4.3.1 adds reusable transport authorization adapters so request handlers can consistently enforce centralized policy decisions across HTTP, WebSocket/stream, and IPC paths.

## Canonical files

- `infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `infrastructure/transport/authorization/index.ts`
- `infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `src/infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter.ts`
- `infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`

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
