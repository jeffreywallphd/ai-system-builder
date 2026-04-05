# Feature 4 / Epic 4.1 Baseline: Authorization, Visibility, and Sharing

This document is the implementation baseline for Feature 4 authorization foundations delivered in Epic 4.1. It captures the current production-ready contracts and seams that later epics must build on without redefining authorization semantics.

## Baseline status

Epic 4.1 currently provides a complete contract foundation for:

- workspace-aware RBAC domain modeling
- canonical permission catalog and naming
- workspace role semantics and baseline grants
- resource visibility and explicit sharing contracts
- application-level policy evaluation ports/use-case seam
- boundary schema validation for authorization payloads
- persistence DTO/repository contracts for role/sharing/resource policy metadata

What is intentionally not in this epic:

- no production infrastructure adapter implementing `IAuthorizationPolicyEvaluator`
- no runtime-wide enforcement wiring across every protected feature path yet
- no finalized admin API transport endpoints for authorization management operations yet

## Canonical implementation files

### Domain authorization core

- `src/domain/authorization/AuthorizationDomain.ts`
- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/domain/authorization/AuthorizationRoleDefinitions.ts`

### Shared contracts and DTO/schemas

- `src/shared/contracts/authorization/AuthorizationPolicyContracts.ts`
- `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts`
- `src/shared/dto/authorization/AuthorizationPersistenceDtos.ts`

### Application seams

- `src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts.ts`
- `src/application/authorization/ports/AuthorizationPolicyEvaluationPorts.ts`
- `src/application/authorization/ports/AuthorizationPolicyPersistencePorts.ts`
- `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`

### Contract tests anchoring behavior

- `src/domain/authorization/tests/AuthorizationDomain.test.ts`
- `src/domain/authorization/tests/AuthorizationPermissionCatalog.test.ts`
- `src/domain/authorization/tests/AuthorizationRoleDefinitions.test.ts`
- `src/shared/contracts/authorization/tests/ResourceVisibilitySharingContracts.test.ts`
- `src/shared/schemas/authorization/tests/AuthorizationSchemaContracts.test.ts`
- `src/shared/dto/authorization/tests/AuthorizationPersistenceDtos.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyPortsContracts.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyPersistencePortsContracts.test.ts`

## Contract model baseline

### 1. Authorization domain model (`AuthorizationDomain.ts`)

Core aggregate/value contracts:

- `RoleAssignment` and `PermissionGrant` with explicit scope (`global` | `workspace` | `resource`)
- `ActorContext` with user/service principal support
- `ResourcePolicyContext` with ownership scope, visibility, sharing policy, and publication metadata
- `SharingGrant` / `SharingSubject` with user, workspace-role, workspace, and public targeting
- `PolicyDecision` with deterministic outcome/reason and matched role/grant/share references

Key invariants are enforced in constructors (`createRoleAssignment`, `createPermissionGrant`, `createResourcePolicyContext`, etc.) so invalid combinations are rejected before evaluation adapters run.

### 2. Permission catalog (`AuthorizationPermissionCatalog.ts`)

Authoritative naming contract:

- `<resource-family>.<action>`

Current protected families:

- `asset`, `system`, `workflow`, `template`, `run`, `queue`, `log`, `storage-instance`, `secret-metadata`, `artifact`

Consumer-safe lookup helpers:

- `AuthorizationPermissionCatalog.resources.<family>.<action>`
- `createCatalogPermissionKey(...)`
- `isCatalogPermissionKey(...)`
- `getCatalogActionsForResourceFamily(...)`

### 3. Role semantics (`AuthorizationRoleDefinitions.ts`)

Canonical workspace role keys:

- `owner`, `admin`, `member`, `viewer`

Baseline semantics:

- owner: full catalog
- admin: full catalog minus publish/unpublish lifecycle permissions
- member: collaborator authoring/execution subset
- viewer: read/list subset

Profile layering seam:

- `createAuthorizationRoleCatalog(overrides)` supports deployment-profile add/remove permissions and grant-strategy overrides with catalog validation.

### 4. Visibility + explicit sharing (`ResourceVisibilitySharingContracts.ts`)

Protected resources expose one canonical authorization envelope:

- subject (`resourceFamily`, `resourceType`, `resourceId`)
- ownership/workspace attribution
- `visibility` (`private`, `workspace`, `shared`, `published`)
- sharing policy (`owner-only`, `workspace-members`, `explicit`, `published`)
- explicit grants when required
- publication capability metadata

Compatibility seam for existing resources:

- `adaptLegacyProtectedResourceAuthorizationContract(...)`

### 5. Application policy evaluation seam (`EvaluateAuthorizationPolicyUseCase.ts`)

Epic 4.1 includes one orchestration use case that resolves evaluation context and delegates decisioning:

- input: `AuthorizationPolicyEvaluationRequestDto`
- loads memberships, grants, sharing grants, and resource policy metadata through ports
- materializes domain-safe `ActorContext` + `ResourcePolicyContext`
- calls `IAuthorizationPolicyEvaluator.evaluatePolicy(...)`
- emits optional best-effort event through `IAuthorizationPolicyEventRecorder`
- returns typed failures (`invalid-request`, `resource-not-found`, `invalid-context`)

### 6. Boundary schema contracts (`AuthorizationSchemaContracts.ts`)

Reusable parse/validation contracts are implemented for:

- policy evaluation requests
- sharing grant upsert/revoke requests
- visibility update requests
- role assignment requests (assign/reassign/revoke)
- resource policy metadata payloads

This schema layer is transport-neutral and ready for HTTP, IPC, or UI boundary parsing.

### 7. Persistence contracts (`AuthorizationPersistenceDtos.ts` + persistence ports)

Repository DTO contracts define:

- idempotent mutation envelopes (`operationKey`)
- optional optimistic concurrency (`expectedRevision`)
- audit stamps and mutation context
- revocation/soft-delete lifecycle semantics
- deterministic lookup key helpers for resource tuples and sharing subjects

Persistence repositories are split by responsibility:

- role assignment persistence
- sharing grant persistence
- resource policy metadata persistence

## Permission-check flow baseline (as implemented)

Current flow exposed by `EvaluateAuthorizationPolicyUseCase`:

```text
Caller -> AuthorizationPolicyEvaluationRequestDto
  -> Validate principal + permission key shape
  -> Resource policy metadata read (required)
  -> Parallel reads:
     - actor memberships (when actorUserIdentityId exists)
     - role + direct permission grants
     - sharing grants for resource
  -> Build ActorContext + ResourcePolicyContext (domain invariants enforced)
  -> Delegate to IAuthorizationPolicyEvaluator
  -> Return decision + resolved context snapshot
  -> Best-effort evaluation event record (optional, non-blocking)
```

Decision adapter boundary:

```text
Use case owns context loading and domain-safe context construction.
Policy evaluator owns allow/deny/not-applicable decision logic.
Event recorder owns observability side effects only.
```

## Where to extend next (without breaking contracts)

### Add a new permission

1. Update `AuthorizationPermissionActionMatrix` in `AuthorizationPermissionCatalog.ts`.
2. Use exported helper lookups in consuming code; do not hardcode strings.
3. Update role mappings/tests as needed.
4. Update docs (`authorization-permission-catalog*.md` + this baseline).

### Add or modify role semantics

1. Update `buildBaselineRoleDefinitions()` in `AuthorizationRoleDefinitions.ts`.
2. Keep role-key stability unless explicitly versioned by story.
3. Validate all permissions against catalog keys.
4. Update role tests and docs.

### Add authorization metadata to a resource family

1. Project resource fields into `ProtectedResourceAuthorizationContract`.
2. Use `adaptLegacyProtectedResourceAuthorizationContract(...)` when legacy fields are incomplete.
3. Persist canonical visibility/sharing metadata through persistence contracts.
4. Keep `resourceFamily/resourceType/resourceId` tuple stable for lookups.

### Add a policy evaluator adapter

1. Implement `IAuthorizationPolicyEvaluator`.
2. Keep evaluator pure to decisioning; do not move repository reads into evaluator.
3. Preserve domain constructor usage in use case for invariant enforcement.
4. Map policy reasons to stable `PolicyDecision.reasonCode` values.

### Add admin/user management flows on this foundation

1. Parse inbound payloads with `AuthorizationSchemaContracts` parse helpers.
2. Use persistence repository ports for mutation/query semantics.
3. Reuse operation-key and revision contracts for idempotency/concurrency behavior.
4. Keep transport mapping outside use cases/ports.

## Related architecture docs

- `docs/architecture/authorization-foundation.md`
- `docs/architecture/authorization-permission-catalog.md`
- `docs/architecture/authorization-role-reference.md`
- `docs/architecture/authorization-visibility-sharing-contracts.md`
- `docs/architecture/authorization-application-ports.md`
- `docs/architecture/authorization-schema-validation-contracts.md`
- `docs/architecture/authorization-persistence-contracts.md`

