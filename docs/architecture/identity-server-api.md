# Identity Server API

This note documents the authoritative HTTP server endpoints for local identity registration and login.

## Endpoint surface

- `POST /api/v1/identity/register`
- `POST /api/v1/identity/login`

Implemented transport and host composition:

- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `hosts/server/IdentityServerHost.ts`

## Request contracts

### Register request

```json
{
  "username": "string",
  "email": "string (optional)",
  "displayName": "string (optional)",
  "providerId": "string (optional)",
  "providerSubject": "string (optional)",
  "credentialPolicyId": "string (optional)",
  "credential": {
    "candidate": "string"
  }
}
```

### Login request

```json
{
  "providerId": "string (optional)",
  "providerSubject": "string",
  "credential": {
    "candidate": "string"
  }
}
```

Validation is performed with `zod` at the HTTP transport boundary.

## Response contracts

All responses use one envelope:

- success: `{ "ok": true, "data": ... }`
- failure: `{ "ok": false, "error": { "code": "...", "message": "...", "validationErrors"?: [...] } }`

### Register success

```json
{
  "ok": true,
  "data": {
    "userIdentityId": "user-identity:...",
    "providerId": "provider:local-password",
    "providerSubject": "normalized-subject",
    "registeredAt": "2026-04-04T18:00:00.000Z"
  }
}
```

### Login success

```json
{
  "ok": true,
  "data": {
    "userIdentityId": "user-identity:...",
    "username": "normalized-username",
    "email": "user@example.com",
    "displayName": "optional",
    "providerId": "provider:local-password",
    "providerSubject": "normalized-subject",
    "authPath": "password",
    "authenticatedAt": "2026-04-04T18:00:00.000Z"
  }
}
```

## Stable error mapping

Error codes exposed to clients:

- `invalid-request`
- `conflict`
- `authentication-failed`
- `account-inactive`
- `unsupported-provider`
- `internal`

HTTP status mapping:

- `400` -> `invalid-request`
- `401` -> `authentication-failed`
- `403` -> `account-inactive`
- `409` -> `conflict`
- `422` -> `unsupported-provider`
- `500` -> `internal`

Application identity failures are translated through `IdentityAuthBackendApi` into this stable external set.

## Secure logging and redaction

`IdentityHttpServer` logs request/response events with structured fields while redacting sensitive credential material.

Redacted keys include:

- `credential`
- `candidate`
- `hashValue`
- `salt`
- `pepperVersion`
- `authorization`
- `bearerToken`

The transport tests verify that raw credential candidates do not appear in log output.

## Test coverage

- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
