# Authorization Schema Validation Contracts

This note documents Story 4.1.6 (Feature 4 / Epic 4.1): shared schema definitions and payload validation contracts for authorization operations.

## Canonical artifacts

- `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts`
- `src/shared/schemas/authorization/tests/AuthorizationSchemaContracts.test.ts`

## Scope and intent

This story adds transport-safe schema validation for authorization payloads before use-case orchestration executes domain logic. The schema layer is reusable by HTTP handlers, IPC handlers, and UI form adapters.

Core validation coverage includes:

- permission-check requests (`AuthorizationPolicyEvaluationRequestDto` shape)
- sharing grant change requests
- visibility update requests
- role assignment requests
- resource authorization metadata payloads

## Schema contracts provided

`AuthorizationSchemaContracts.ts` exports:

- reusable primitives:
  - principal/workspace/resource identifier validation
  - permission-key namespace validation
  - ISO timestamp validation
  - sharing-target discriminated unions
- operation schemas:
  - `AuthorizationPolicyEvaluationRequestDtoSchema`
  - `AuthorizationSharingGrantChangeRequestSchema`
  - `AuthorizationVisibilityUpdateRequestSchema`
  - `AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema`
  - `AuthorizationRoleAssignmentRequestSchema`
  - `AuthorizationResourcePolicyMetadataSchema`
- parse helpers with typed failures:
  - `parseAuthorizationPolicyEvaluationRequestDto(...)`
  - `parseAuthorizationSharingGrantChangeRequest(...)`
  - `parseAuthorizationVisibilityUpdateRequest(...)`
  - `parseAuthorizationBulkWorkspaceRoleSharingGrantRequest(...)`
  - `parseAuthorizationRoleAssignmentRequest(...)`
  - `parseAuthorizationResourcePolicyMetadata(...)`

## Invariants enforced at schema layer

- actor reference requires `actorUserIdentityId` or `actorServiceId`.
- permission keys must be namespaced (for example `asset.read`).
- supported visibility values are restricted to canonical authorization visibility modes.
- workspace-oriented sharing subjects require workspace scope and matching `workspaceId`.
- public sharing subjects require published visibility.
- visibility + sharing-policy combinations must match canonical rules (`private` + `owner-only`, `workspace` + `workspace-members`, `shared` + `explicit`, `published` + `published`).
- role assignment operations enforce managed role forms and reject malformed reassignment payloads.
- resource policy metadata payloads enforce ownership/visibility/publication coherence.

## Usage guidance: schemas vs domain invariants

Use schema validation when:

- parsing untrusted payloads (HTTP body, IPC args, UI form state)
- normalizing primitive field shape and required/optional field presence
- rejecting malformed request contracts at boundaries

Use domain invariants when:

- validating business transitions and aggregate state evolution
- enforcing lifecycle constraints that depend on current persisted state
- applying mutation semantics after boundary payloads are already schema-valid

In short: schemas protect boundary contracts; domain logic protects behavioral correctness.

## Test coverage

`AuthorizationSchemaContracts.test.ts` covers valid and invalid cases for all operation schemas, including:

- actor/principal validation failures
- workspace scoping mismatches
- invalid visibility/policy combinations
- malformed sharing-subject forms
- malformed role assignment operations
- publication metadata violations
- duplicate bulk resource targets and oversized bulk sharing payloads
- typed `AuthorizationSchemaValidationError` failure shape
