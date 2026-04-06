# Secret Metadata Management Internal APIs

This note documents Story 8.2.4 (Feature 8 / Epic 8.2): internal server API endpoints for secret metadata management.

## Canonical artifacts

- `infrastructure/api/security/sdk/PublicSecretMetadataApiContract.ts`
- `infrastructure/api/security/SecretMetadataBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `hosts/server/IdentityServerHost.ts`
- `infrastructure/api/security/tests/SecretMetadataBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerSecretMetadata.test.ts`

## Endpoints

- `POST /api/v1/security/secrets`
  - creates a secret from plaintext input.
  - response returns metadata-only `secret` projection.
- `GET /api/v1/security/secrets`
  - lists metadata by explicit owner scope (`scope`, optional `workspaceId`, optional `userIdentityId`).
- `GET /api/v1/security/secrets/{secretId}`
  - reads one metadata record by id.
- `POST /api/v1/security/secrets/{secretId}/disable`
  - disables a secret record and returns updated metadata.

No UI-facing plaintext retrieval endpoint is exposed.

## Validation and response posture

- Transport request validation is enforced with route-level schemas and query validation checks.
- Validation failures return stable `invalid-request` API errors with typed validation details.
- Responses intentionally exclude plaintext and encrypted payload internals.
- Route request logging uses redacted payload shaping for secret creation (`plaintextProvided` flag only).

## Actor, authorization, and audit behavior

- Authenticated actor identity is propagated from session context (`actorUserIdentityId`).
- API operations invoke secret-domain authorization through existing secret use cases (`ISecretAccessPolicyPort` flow).
- Optional workspace context (`actorWorkspaceId`) is resolved only when the actor has active workspace authorization snapshot membership; otherwise scope checks fail closed.
- Secret access-decision and operation audit hooks continue to execute through composed secret service collaborators.

## Error mapping

Secret service outcomes are mapped to API contracts:

- `secret-invalid-request` -> `invalid-request`
- `secret-access-denied` -> `forbidden`
- `secret-not-found` -> `not-found`
- `secret-conflict` / `secret-invalid-state` / `secret-policy-violation` -> `conflict`
- `secret-internal` -> `internal`

## Tests

Coverage verifies:

- happy-path create/list/get/disable route behavior
- denial behavior for unauthorized metadata read/disable
- request validation failures for body and query parameters
- backend API mapping and fail-closed workspace actor-context handling
