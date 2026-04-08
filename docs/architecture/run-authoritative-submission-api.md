# Run Authoritative Submission API

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.1: Establish the Authoritative Run Domain and Submission Pipeline
- Story 16.1.5: Implement the authoritative run submission API and command handling surface

## Purpose

Expose production run submission as an authoritative server operation so desktop and thin clients submit through one authenticated, workspace-scoped API path with canonical success and failure semantics.

## Canonical implementation files

- `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
- `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
- `src/infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- `src/hosts/server/IdentityServerHost.ts`

## API behavior

`POST /api/v1/runtime/runs/start` now supports authoritative run submission through the control-plane path:

1. Require authenticated workspace session (`workspaceId` query scope).
2. Parse canonical run submission payload (legacy start-run payload compatibility remains at the transport parser level).
3. Reject context spoofing when payload `workspaceId` or `submittedByActorId` does not match authenticated session context.
4. Enforce authoritative context by setting submission actor/workspace from authenticated session.
5. Delegate to `SubmitImageRunUseCase` for authoritative submission orchestration:
   - validation (`ValidateRunSubmissionUseCase`)
   - image submission readiness evaluation (blocking vs advisory findings)
   - authoritative creation (`CreateAuthoritativeRunUseCase`)
6. Return canonical run detail + shared mutation metadata on acceptance.

## Failure semantics

- unauthenticated route access: `401` + `authentication-failed`
- malformed or context-mismatched submission: `400` + `invalid-request`
- validation/policy denials: stable shared error mapping (`forbidden`, `not-found`, etc.) with domain code preservation
- run-creation conflicts: `409` + `conflict`

## Route registration posture

- Added dedicated route family: `run-submission`.
- Added dedicated backend key: `run-submission`.
- Authoritative server route composition now requires this family as part of required authoritative coverage.

## Test coverage

- `src/infrastructure/api/runs/tests/AuthoritativeRunSubmissionBackendApi.test.ts`
  - canonical accepted response mapping
  - validation denial mapping
  - conflict mapping
  - asset-backed runtime target resolution behavior
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRunSubmissionApi.test.ts`
  - authenticated workspace guard enforcement
  - actor/workspace mismatch rejection
  - canonical response forwarding
  - HTTP error-status mapping for backend denials
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
  - route-family registration/selection coverage for `run-submission`
