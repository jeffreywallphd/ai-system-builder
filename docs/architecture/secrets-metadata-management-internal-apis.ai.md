# AI Companion: Secret Metadata Management Internal APIs

## Purpose

Story 8.2.4 baseline for Feature 8 / Epic 8.2: expose internal server API surfaces for secret metadata management without plaintext response exposure.

## Canonical files

- `infrastructure/api/security/sdk/PublicSecretMetadataApiContract.ts`
- `infrastructure/api/security/SecretMetadataBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `hosts/server/IdentityServerHost.ts`
- `infrastructure/api/security/tests/SecretMetadataBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerSecretMetadata.test.ts`
- `docs/architecture/secrets-metadata-management-internal-apis.md`

## Endpoint summary

- `POST /api/v1/security/secrets` (create)
- `GET /api/v1/security/secrets` (list metadata)
- `GET /api/v1/security/secrets/{secretId}` (detail metadata)
- `POST /api/v1/security/secrets/{secretId}/disable` (disable)

No plaintext retrieval endpoint is added.

## Behavior summary

- Session actor identity is propagated into secret operation requests.
- Request validation is enforced for body and query inputs.
- Secret authorization + audit hooks execute through existing use-case policy/audit seams.
- Workspace actor context is fail-closed when membership is not active.
- API responses use metadata-only secret references and exclude plaintext.

## Error posture

- invalid request -> `invalid-request`
- denied -> `forbidden`
- missing -> `not-found`
- state/conflict/policy violations -> `conflict`
- internal failures -> `internal`

## Test posture

- backend API tests validate mapping and fail-closed actor context behavior.
- HTTP server route tests validate happy path, denial path, and validation path for secret metadata endpoints.
