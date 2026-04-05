# AI Companion: Authorization Schema Validation Contracts

## Purpose

Story 4.1.6 adds shared authorization payload schemas so malformed requests fail at transport boundaries before use-case/domain orchestration.

## Canonical files

- `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts`
- `src/shared/schemas/authorization/tests/AuthorizationSchemaContracts.test.ts`

## Contracts added

- `AuthorizationPolicyEvaluationRequestDtoSchema`
- `AuthorizationSharingGrantChangeRequestSchema`
- `AuthorizationVisibilityUpdateRequestSchema`
- `AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema`
- `AuthorizationRoleAssignmentRequestSchema`
- `AuthorizationResourcePolicyMetadataSchema`

Plus reusable parse helpers and typed validation errors:

- `AuthorizationSchemaValidationError`
- `parseAuthorizationPolicyEvaluationRequestDto(...)`
- `parseAuthorizationSharingGrantChangeRequest(...)`
- `parseAuthorizationVisibilityUpdateRequest(...)`
- `parseAuthorizationBulkWorkspaceRoleSharingGrantRequest(...)`
- `parseAuthorizationRoleAssignmentRequest(...)`
- `parseAuthorizationResourcePolicyMetadata(...)`

## Invariant alignment

Schema-level refinements mirror previously defined authorization contracts/invariants:

- canonical visibility values only (`private`, `workspace`, `shared`, `published`)
- canonical sharing-policy/visibility coherence
- workspace sharing subject scoping rules
- public sharing target only for `published`
- role reassignment requires distinct source/target roles
- published metadata requires publication capability + timestamp
- bulk workspace-role sharing grants reject duplicate resources and enforce bounded target counts

## Boundary guidance

- Use schemas in HTTP/IPC/UI boundary adapters.
- Keep business-state/lifecycle enforcement in domain/application use cases.
- Treat schema validation as malformed-payload protection, not replacement for aggregate invariants.
