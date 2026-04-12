# AI Companion: Run Authoritative Submission API

## Story scope
Story 16.1.5 wires the authoritative run submission API surface so converged clients submit runs through authenticated server orchestration instead of local/mock start-run paths.

## Implemented files
- `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
- `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
- `src/infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- `src/hosts/server/IdentityServerHost.ts`
- Human doc: `docs/architecture/run-authoritative-submission-api.md`

## Core behavior
- `POST /api/v1/runtime/runs/start` now routes to `AuthoritativeRunSubmissionBackendApi` when composed.
- `POST /api/v1/image-systems/:systemId/runs` now aliases to the same authoritative submission flow for image-focused clients.
- Transport enforces authenticated actor/workspace context:
  - payload `workspaceId` and `submittedByActorId` must match session context when provided
  - server overwrites submission context with authenticated actor/workspace before backend execution
  - image alias route enforces `runtimeTarget.systemId` to match `:systemId` when present in payload
- Backend orchestration sequence:
  - delegate submission orchestration to `SubmitImageRunUseCase`
  - inside the use case: validate submission, evaluate image submission readiness, and create canonical authoritative run
  - return canonical `RunSubmissionAcceptedResponse` with shared mutation metadata

## Error mapping posture
- validation codes map to shared failure envelope semantics:
  - `invalid-request` -> `invalid-request`
  - `not-found` -> `not-found`
  - `forbidden` / `policy-ineligible` -> `forbidden` (domain code preserved)
- run-creation conflict-like failures map to `conflict`
- unmatched failures map to `internal`

## Route registration changes
- Added backend key: `run-submission`.
- Added runtime route family: `run-submission` (prefix `/api/v1/runtime/runs/start`).
- Authoritative host required route-family coverage now includes `run-submission`.

## Tests
- `src/infrastructure/api/runs/tests/AuthoritativeRunSubmissionBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRunSubmissionApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerImageRunAuthoritativeApi.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
