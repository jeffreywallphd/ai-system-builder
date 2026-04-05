# AI Companion: Feature 4 / Epic 4.3 Protected Resource Enforcement and Runtime Integration

## Purpose

Story 4.3.1 introduces reusable transport-layer authorization enforcement adapters so HTTP, WebSocket/stream, and IPC request paths can invoke the centralized policy engine without duplicating decision logic.

## Canonical files

- `infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `infrastructure/transport/authorization/index.ts`
- `infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`

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
