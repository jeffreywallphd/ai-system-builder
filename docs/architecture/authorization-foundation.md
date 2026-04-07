# Authorization Foundation

This note documents Story 4.1.1 (Feature 4 / Epic 4.1): core authorization domain models for workspace-aware RBAC, resource visibility, explicit sharing, actor/resource policy context, and reusable policy decision contracts.

## Scope in this story

- Adds framework-agnostic authorization src/domain/value contracts in `src/domain/authorization/AuthorizationDomain.ts`.
- Adds deterministic invariant checks for invalid combinations across:
  - role-assignment scope state,
  - permission-grant scope state,
  - resource ownership scope and visibility mode,
  - sharing policy mode and sharing grants,
  - future published-capable visibility semantics.
- Adds a shared cross-layer evaluation contract seam in:
  - `src/shared/contracts/authorization/AuthorizationPolicyContracts.ts`.
- Adds focused domain test coverage in:
  - `src/domain/authorization/tests/AuthorizationDomain.test.ts`.

## Canonical artifacts

- `src/domain/authorization/AuthorizationDomain.ts`
- `src/domain/authorization/tests/AuthorizationDomain.test.ts`
- `src/shared/contracts/authorization/AuthorizationPolicyContracts.ts`
- `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- `src/shared/contracts/authorization/tests/ResourceVisibilitySharingContracts.test.ts`
- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/domain/authorization/tests/AuthorizationPermissionCatalog.test.ts`
- `src/domain/authorization/AuthorizationRoleDefinitions.ts`
- `src/domain/authorization/tests/AuthorizationRoleDefinitions.test.ts`

## Core domain concepts

### RBAC and permission model

- `RoleAssignment`
  - actor-to-role binding with explicit scope (`global`, `workspace`, `resource`) and lifecycle (`active`, `revoked`).
- `PermissionKey`
  - normalized namespaced key format (for example `asset.read`, `workflow.run`, `queue.manage`).
- `PermissionGrant`
  - explicit allow/deny grant with explicit scope (`global`, `workspace`, `resource`), optional expiry/revocation state, and mutation attribution.

### Visibility and sharing model

- `ResourceVisibility`
  - `private`, `workspace`, `shared`, `published`.
- `SharingSubject`
  - explicit subject kinds: user, workspace-role, workspace, public.
- `SharingGrant`
  - subject-scoped permission grant for explicit sharing behavior.
- `SharingPolicy`
  - mode-driven policy contract:
    - `owner-only`
    - `workspace-members`
    - `explicit`
    - `published`

### Policy-evaluation context model

- `ActorContext`
  - actor identity context (user or service), active workspace context, role assignments, and direct permission grants.
- `ResourcePolicyContext`
  - resource identity, owner context, ownership scope (`user-private` vs `workspace`), visibility, sharing policy, sharing grants, and published-capability metadata.
- `PolicyDecision`
  - deterministic evaluation result envelope with outcome (`allow`, `deny`, `not-applicable`), reason code/message, evaluated timestamp, and matched role/grant/share references.

## Invariants enforced

### Role assignment and permission grant scope coherence

- Global-scope role assignments and permission grants cannot include workspace/resource scope fields.
- Workspace-scope role assignments and grants must include `workspaceId` and cannot include resource scope fields.
- Resource-scope role assignments and grants must include both `resourceType` and `resourceId`.
- Revoked role assignments require `revokedAt`.
- Grant expiry/revocation timestamps must be temporally coherent relative to grant creation time.

### Ownership, visibility, and sharing coherence

- `user-private` ownership cannot include `workspaceId`.
- `workspace` ownership must include `workspaceId`.
- `workspace` visibility is only valid for workspace-owned resources.
- `private` and `workspace` visibility cannot include explicit sharing grants.
- `shared` visibility requires:
  - at least one sharing grant,
  - sharing policy mode `explicit`.
- `published` visibility requires:
  - sharing policy mode `published`,
  - `isPublishedCapable=true`,
  - `publishedAt`.
- Public sharing subjects are only valid when visibility is `published`.
- Workspace-oriented sharing subjects require workspace-scoped resources and must match the resource `workspaceId`.

## Workspace/private/src/shared/published semantics

- `private`: owner-only resource policy surface; no explicit share grants.
- `workspace`: workspace-member visibility for workspace-owned resources; no explicit share grants.
- `shared`: explicit grant-based access surface for direct user/workspace subjects.
- `published`: forward-compatible public distribution posture gated behind explicit capability metadata (`isPublishedCapable`) and publication timestamp.

## Architectural posture

- Domain remains infrastructure/UI/runtime agnostic:
  - no persistence adapters,
  - no Electron/Express/UI contracts,
  - no filesystem/runtime dependencies.
- Shared contract seam is intentionally small and application-facing:
  - `AuthorizationPolicyEvaluationRequest`
  - `AuthorizationPolicyEvaluationResult`
- This story provides authoritative policy-model contracts for upcoming application-layer policy services and enforcement seams without coupling to transport/storage decisions.

## Permission catalog seam

Story 4.1.2 adds the canonical permission catalog and resource-action matrix for deterministic permission naming and reusable permission lookups.

- Developer reference: `docs/architecture/authorization-permission-catalog.md`

## Role-definition seam

Story 4.1.3 adds the canonical workspace role-definition layer and role-to-permission baseline mappings for policy evaluation inputs.

- Developer reference: `docs/architecture/authorization-role-reference.md`

## Visibility + sharing contract seam

Story 4.1.4 adds a reusable protected-resource contract for visibility and explicit sharing metadata.

- Canonical contract file: `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- Contract tests: `src/shared/contracts/authorization/tests/ResourceVisibilitySharingContracts.test.ts`
- Developer reference: `docs/architecture/authorization-visibility-sharing-contracts.md`

## Application ports + policy evaluator seam

Story 4.1.5 adds the application-layer authorization context-loading ports and policy-evaluation interfaces used by enforcement use-cases.

- Canonical contract files:
  - `src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts.ts`
  - `src/application/authorization/ports/AuthorizationPolicyEvaluationPorts.ts`
  - `src/application/authorization/use-cases/EvaluateAuthorizationPolicyUseCase.ts`
- Contract tests: `src/application/authorization/tests/AuthorizationPolicyPortsContracts.test.ts`
- Developer reference: `docs/architecture/authorization-application-ports.md`

## Schema validation contracts seam

Story 4.1.6 adds shared authorization payload schemas for boundary validation of policy-related requests before use-case/domain orchestration.

- Canonical contract files:
  - `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts`
- Contract tests:
  - `src/shared/schemas/authorization/tests/AuthorizationSchemaContracts.test.ts`
- Developer reference:
  - `docs/architecture/authorization-schema-validation-contracts.md`

## Persistence contracts seam

Story 4.1.7 adds migration-ready persistence DTOs and repository-port contracts for role assignments, sharing grants, and resource policy metadata.

- Canonical contract files:
  - `src/shared/dto/authorization/AuthorizationPersistenceDtos.ts`
  - `src/application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository.ts`
  - `src/application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository.ts`
  - `src/application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository.ts`
- Contract tests:
  - `src/shared/dto/authorization/tests/AuthorizationPersistenceDtos.test.ts`
  - `src/application/authorization/tests/AuthorizationPolicyPersistencePortsContracts.test.ts`
- Developer reference:
  - `docs/architecture/authorization-persistence-contracts.md`

## End-to-end baseline seam

Story 4.1.8 documents the consolidated implementation baseline for the full Epic 4.1 authorization foundation, including extension rules and permission-check flow references.

- Baseline reference:
  - `docs/architecture/authorization-feature-4-epic-4.1-baseline.md`
