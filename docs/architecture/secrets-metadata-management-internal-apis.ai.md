# AI Companion: Secret Metadata Management Internal APIs

## Purpose

Story 8.2.4 baseline for Feature 8 / Epic 8.2: expose internal server API surfaces for secret metadata management without plaintext response exposure.

## Canonical files

- `infrastructure/api/security/sdk/PublicSecretMetadataApiContract.ts`
- `infrastructure/api/security/SecretMetadataBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/shared/contracts/security/SecretTransportContracts.ts`
- `src/shared/dto/security/SecretTransportDtos.ts`
- `src/shared/schemas/security/SecretApiSchemaContracts.ts`
- `hosts/server/IdentityServerHost.ts`
- `infrastructure/api/security/tests/SecretMetadataBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerSecretMetadata.test.ts`
- `src/shared/schemas/security/tests/SecretApiSchemaContracts.test.ts`
- `src/shared/dto/security/tests/SecretTransportDtos.test.ts`
- `docs/architecture/secrets-metadata-management-internal-apis.md`

## Endpoint summary

- `POST /api/v1/security/secrets` (create)
- `GET /api/v1/security/secrets` (list metadata)
- `GET /api/v1/security/secrets/{secretId}` (detail metadata)
- `POST /api/v1/security/secrets/{secretId}/disable` (disable)

No plaintext retrieval endpoint is added.

## Behavior summary

- Session actor identity is propagated into secret operation requests.
- Request validation is enforced via shared secret schema contracts consumed by transport/API/application seams.
- Secret authorization + audit hooks execute through existing use-case policy/audit seams.
- Workspace actor context is fail-closed when membership is not active.
- API responses use metadata-only secret references and exclude plaintext.

## DTO safety summary

- Command DTOs (`CreateSecretCommandDto`, `DisableSecretCommandDto`) are scoped to mutation inputs.
- Query DTOs (`SecretMetadataQueryDto`) are metadata-only and exclude plaintext/encrypted material fields by contract.
- Secret metadata record mapping in backend APIs now routes through shared safe DTO mapping helpers.

## Validation coverage summary

- scope identifier + owner invariants
- secret key/name shape constraints
- display-name / metadata label safety constraints
- classification compatibility checks
- rotation instruction shape and scheduled-cadence requirements

## Error posture

- invalid request -> `invalid-request`
- denied -> `forbidden`
- missing -> `not-found`
- state/conflict/policy violations -> `conflict`
- internal failures -> `internal`

## Test posture

- backend API tests validate mapping and fail-closed actor context behavior.
- HTTP server route tests validate happy path, denial path, and validation path for secret metadata endpoints.
