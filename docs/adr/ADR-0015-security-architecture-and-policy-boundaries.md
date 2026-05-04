# ADR-0015: Security Architecture and Policy Boundaries

- Status: accepted
- Date: 2026-05-04
- Deciders: ai-system-builder maintainers
- Related: ADR-0003, ADR-0013, docs/architecture/system-overview.md, docs/architecture/host-model.md, docs/architecture/persistence-and-storage.md, docs/architecture/runtime-model.md, docs/architecture/module-dependency-rules.md

## Context

`ai-system-builder` supports desktop, server, and thin-client surfaces. Server/thin-client operation and future desktop remote execution require secure communication boundaries that stay aligned with clean architecture.

The first practical secure LAN target is HTTPS + LAN pairing bearer tokens:

- HTTPS/TLS provides confidentiality, integrity, and server authentication.
- Bearer tokens authenticate clients but do **not** encrypt traffic.
- LAN pairing issues device bearer tokens after short-lived one-time pairing flow.

The architecture must remain open to swappable future modes through adapters: external TLS termination, mTLS, API keys, web CA certificates, reverse-proxy identity, and other secure transfer mechanisms.

Security scope also extends beyond transport: authentication, authorization, storage security, secret/credential handling, audit logging, input hardening, runtime/process security, model/plugin supply-chain security, and privacy/data governance.

Clean architecture constraints apply: security mechanisms should be adapter-driven and composed by hosts, not embedded in domain logic, React UI code, or feature route business logic.

## Decision

Security is a cross-cutting architecture concern implemented through shared contracts, application ports/services, adapters, and host composition.

- Not all security-related code belongs in `security/` folders.
- Shared security primitives belong in security folders.
- Feature-specific security declarations and enforcement remain near feature/transport boundaries while consuming shared security contracts/ports.
- Transport authentication/encryption is adapter-based and swappable.
- Storage security is separate from transport security and enforced via storage adapters plus resource-aware application services.
- Authorization policy is centralized, but enforcement is layered.
- Secrets/credentials are handled through security/credential-store ports, not general settings bags.
- Audit logging is separate from normal diagnostics.
- Dev no-auth mode must be explicit and noisy.
- Initial implementation target: `HTTPS + LAN pairing bearer token`.
- Future modes are added by new adapters, not use-case rewrites.

## Security domains

1. **Identity and authentication**
   - Responsibility: principal identity, token/session validation, device pairing.
   - Likely ownership: `modules/contracts/security`, `modules/application/ports/security`, `modules/adapters/security/*`, transport security middleware.
2. **Authorization and policy**
   - Responsibility: scope/operation/resource policy decisions and denials.
   - Likely ownership: centralized policy contracts/ports plus layered transport/application enforcement.
3. **Transport security**
   - Responsibility: HTTPS/TLS, request authentication envelopes, secure headers, boundary rate limiting.
   - Likely ownership: transport adapters + host composition/security config.
4. **Storage security**
   - Responsibility: storage-key handling, path containment, artifact access enforcement, optional at-rest protection seam.
   - Likely ownership: storage adapters + application services for actor-aware access.
5. **Secrets and credential management**
   - Responsibility: secure secret storage, hashing, retrieval, rotation/revocation seams.
   - Likely ownership: security credential ports/adapters + host config seams.
6. **Audit logging and security diagnostics**
   - Responsibility: durable security event trails, action/actor/outcome tracing.
   - Likely ownership: audit-log ports/adapters + application/transport emission points.
7. **Data validation and input hardening**
   - Responsibility: malformed/oversized payload rejection, strict boundary validation.
   - Likely ownership: transport adapters + request-validation helpers.
8. **Runtime/process isolation**
   - Responsibility: safe process invocation, environment restrictions, temp/path containment.
   - Likely ownership: runtime adapters + host runtime composition.
9. **Supply-chain/model/plugin security**
   - Responsibility: provider/download provenance, integrity checks, plugin/model risk controls.
   - Likely ownership: runtime/storage/provider adapters and host policy composition.
10. **Privacy/data governance**
   - Responsibility: data minimization, redaction, retention/deletion policy seams.
   - Likely ownership: contracts/policies + storage/persistence/application enforcement points.

## Recommended file structure

```txt
modules/
  contracts/
    security/
      index.ts
      auth-context.ts
      auth-principal.ts
      auth-scope.ts
      auth-session.ts
      security-error.ts
      security-mode.ts
      security-status.ts
      authorization-policy.ts
      security-event.ts
      credential-metadata.ts
      encryption-metadata.ts
      data-classification.ts
      resource-identifier.ts
      lan-pairing.ts

  application/
    ports/
      security/
        index.ts
        authentication-provider.port.ts
        authorization-policy.port.ts
        credential-store.port.ts
        token-issuer.port.ts
        token-verifier.port.ts
        encryption-key-provider.port.ts
        data-protection.port.ts
        audit-log.port.ts
        security-event-sink.port.ts
        secret-redactor.port.ts

    services/
      security/
        authenticate-request.service.ts
        authorize-operation.service.ts
        authorize-resource-access.service.ts
        classify-data.service.ts
        redact-sensitive-data.service.ts
        create-security-context.service.ts

  adapters/
    security/
      noop/
        createDevelopmentNoAuthSecurityAdapter.ts
        createAllowAllAuthorizationPolicy.ts

      lan/
        createLanPairingTokenIssuerAdapter.ts
        createLanBearerTokenVerifierAdapter.ts
        createLanDeviceCredentialStoreAdapter.ts
        createLanAllowlistPolicyAdapter.ts

      api-key/
        createApiKeyVerifierAdapter.ts
        createApiKeyCredentialStoreAdapter.ts

      tls/
        createTlsCertificateIdentityAdapter.ts
        createMtlsPrincipalExtractorAdapter.ts

      crypto/
        createNodeCryptoRandomAdapter.ts
        createNodeCryptoTokenHasher.ts
        createAesGcmDataProtectionAdapter.ts
        createCredentialHasher.ts

      audit/
        createJsonlSecurityAuditLogAdapter.ts
        createStructuredSecurityEventSinkAdapter.ts

      redaction/
        createDefaultSecretRedactor.ts

  adapters/
    transport/
      api-express/
        security/
          index.ts
          createExpressSecurityMiddleware.ts
          apiRouteSecurityPolicy.ts
          extractExpressSecurityInput.ts
          registerSecurityRoutes.ts
          applySecurityHeaders.ts
          createHttpsServerOptions.ts

      api-client/
        security/
          createBearerTokenRequestSigner.ts
          createSecureFetch.ts

      ipc-electron/
        security/
          createIpcSecurityContextAdapter.ts

    storage/
      filesystem/
        security/
          createSecureFilesystemStorageAdapter.ts
          filesystemPathPolicy.ts
          storageEncryptionEnvelope.ts

      huggingface/
        security/
          huggingFaceCredentialPolicy.ts

  hosts/
    server/
      security/
        composeServerSecurity.ts
        resolveServerSecurityConfig.ts
        serverSecurityDefaults.ts

    desktop/
      security/
        composeDesktopSecurity.ts
        resolveDesktopSecurityConfig.ts
        desktopCredentialStore.ts
```

Possible app-level files:

```txt
apps/
  server/
    src/
      security/
        createHttpsServer.ts
        serverSecurityEnv.ts

  thin-client/
    src/
      security/
        pairedDeviceTokenStore.ts
        secureFetch.ts

  desktop/
    src/
      security/
        desktopServerSecuritySettings.ts
```

## What belongs in security folders

Reusable cross-cutting security pieces, including:

- auth context/principal/scope contracts
- token verification/issuance and LAN pairing primitives
- credential stores and authorization policy contracts
- audit log adapters and security-event sinks
- encryption/data-protection and redaction utilities
- TLS/mTLS identity adapters
- Express security middleware and centralized route security policy registry
- host security composition helpers

## What should not all move into security folders

Feature implementation stays in feature areas:

- image-generation route handlers stay in image-generation transport folders
- model-management route handlers stay in model transport folders
- artifact storage remains in storage adapters
- ComfyUI/Python runtime adapters remain in runtime adapters
- feature UI remains in feature UI folders

Those areas should consume shared security contracts/ports/route policies as needed.

## Layered enforcement model

```txt
Transport boundary:
  authenticate request
  enforce coarse operation/route scopes
  reject malformed/oversized input
  apply security headers/rate limits

Application boundary:
  authorize resource-level access
  apply actor-aware use-case rules
  emit audit events for important operations

Adapter boundary:
  enforce filesystem containment
  handle credential storage
  encrypt/decrypt if configured
  harden runtime process invocation
  redact sensitive diagnostics

Host composition:
  choose security mode
  wire concrete security adapters
  resolve credential/security config
  define public routes and route policy
```

## Initial HTTPS + LAN bearer token design

Security modes:

```txt
disabled-dev
lan-https-token
external-tls future
mtls future
api-key future
```

Initial capabilities:

- `disabled-dev`
  - no auth
  - HTTP allowed
  - loud startup warning
- `lan-https-token`
  - HTTPS required
  - LAN pairing issues bearer device token
  - non-public APIs require `Authorization: Bearer <token>`
  - token is random opaque token
  - server stores only token hash
  - pairing code is short-lived and one-time use
  - pairing endpoints are rate-limited

Recommended initial endpoints:

```txt
GET  /api/security/status
POST /api/security/pairing/complete
POST /api/security/token/revoke
```

Optional later:

```txt
POST /api/security/pairing/start
POST /api/security/token/refresh
```

## Recommended libraries

Initial library posture:

- Use Node built-ins first: `node:https`, `node:tls`, `node:crypto`, `node:fs`.
- Recommended packages: `helmet`, `express-rate-limit`, `ipaddr.js`, optional `zod`.
- Defer unless needed: `jose` (JWT/JWK/JWS/JWE), `keytar` (desktop credential store), `passport`/OAuth/full auth frameworks.

Initial bearer tokens should be opaque random tokens via Node crypto (not JWTs) to simplify revocation and preserve server-side control.

## Route policy

Representative centralized policy mapping:

```txt
GET /api/security/status -> public
POST /api/security/pairing/complete -> public

POST /api/model/browse -> model:read
POST /api/model/list -> model:read
POST /api/model/download -> model:write

POST /api/image-generation/start -> image-generation:write
POST /api/image-generation/read -> image-generation:read
POST /api/image-generation/finalize -> image-generation:write
POST /api/image-generation/cancel -> image-generation:write

POST /api/artifact/browse -> artifact:read
GET /api/artifact/media/view -> artifact:read
POST /api/artifact/upload -> artifact:write
```

Route policy should be centralized, not scattered ad hoc across handlers.

## Storage security

- Storage keys are opaque keys, not raw filesystem paths.
- Filesystem adapters must canonicalize paths and verify containment under storage root.
- Artifact reads and writes require authorization.
- Generated outputs should finalize into artifact storage without exposing runtime temp paths.
- Optional encryption at rest should be added via `DataProtectionPort`.
- API responses should not expose local filesystem paths.

## Secrets and credentials

Hugging Face tokens, device tokens, API keys, TLS private keys, signing keys, and encryption keys are secrets.

- Do not store secrets in general settings payloads.
- Store server device tokens as hashes only.
- Desktop credential handling should later use OS credential storage where practical.
- Logs must redact secrets.
- Authorization headers must never be logged.

## Audit logging

Audit logging is distinct from normal diagnostics.

Representative audit events:

- auth success/failure
- token issued/revoked
- authorization denied
- artifact read/write/delete
- model download/publish
- image generation start/cancel/finalize
- settings/security changes

## Consequences

### Positive

- Security architecture remains swappable and adapter-driven.
- First secure LAN implementation is practical.
- mTLS/external TLS/API key modes can be added as adapters.
- Storage security and authorization are explicit, not accidental.
- Clean architecture boundaries are preserved.

### Negative

- Host composition becomes more explicit.
- Central route policy requires ongoing maintenance.
- Token lifecycle and credential storage need careful testing.
- HTTPS certificate setup requires user/admin configuration.
- Redaction/audit diagnostics work increases.

## Non-goals

- Do not implement OAuth now.
- Do not implement mTLS now.
- Do not implement full PKI automation now.
- Do not implement full encryption-at-rest now.
- Do not implement multi-user RBAC UI now.
- Do not move every feature into security folders.
- Do not claim safe public-internet production exposure without additional hardening.

## Follow-up

1. Security contracts/ports, server config seam, Express middleware skeleton, disabled-dev mode.
2. HTTPS server startup and LAN pairing bearer tokens.
3. Thin-client secure fetch and pairing UI.
4. Route policy protection for model/image/artifact routes.
5. Storage security hardening and audit logging.
6. Desktop remote-ready secure API client and credential-store seam.
7. Future mTLS/external TLS/API-key adapters.
