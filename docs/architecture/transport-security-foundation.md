# Transport Security Foundation

This document describes the Story 7.1.1 and Story 7.1.2 transport security baseline for Feature 7 / Epic 7.1.

## Scope

The slice introduces shared domain and application contracts for secure runtime transport decisions across:

- desktop client to control-plane
- thin client to control-plane
- trusted node to control-plane
- service-to-service control-plane channels

Story 7.1.1 defines policy and trust-evaluation contracts.
Story 7.1.2 adds centralized trust-state resolution and transport adapter mapping so inbound/outbound connection checks can consume one validation path.

## Canonical artifacts

- `src/domain/security/TransportSecurityDomain.ts`
- `src/application/security/ports/TransportSecurityPorts.ts`
- `src/application/security/use-cases/EvaluateTransportConnectionPolicyUseCase.ts`
- `src/application/security/ports/TransportTrustValidationPorts.ts`
- `src/application/security/use-cases/ValidateTransportConnectionTrustUseCase.ts`
- `src/shared/contracts/security/TransportSecurityContracts.ts`
- `src/domain/security/tests/TransportSecurityDomain.test.ts`
- `src/application/security/tests/EvaluateTransportConnectionPolicyUseCase.test.ts`
- `src/application/security/tests/ValidateTransportConnectionTrustUseCase.test.ts`
- `src/shared/contracts/security/tests/TransportSecurityContracts.test.ts`
- `src/infrastructure/security/ServerManagedTransportTrustStateResolver.ts`
- `src/application/security/ports/TransportSecurityAuditPorts.ts`
- `src/infrastructure/security/TransportSecurityObservabilityReporter.ts`
- `src/infrastructure/security/tests/ServerManagedTransportTrustStateResolver.test.ts`
- `src/application/security/tests/TransportSecurityAuditPorts.test.ts`
- `src/infrastructure/security/tests/TransportSecurityObservabilityReporter.test.ts`
- `src/infrastructure/transport/TransportTrustValidationAdapters.ts`
- `src/infrastructure/transport/tests/TransportTrustValidationAdapters.test.ts`

## Domain vocabulary

### Scenarios

- `desktop-client-to-control-plane`
- `thin-client-to-control-plane`
- `node-to-control-plane`
- `service-to-service`

### Channel and peer vocabulary

- channel types: `http`, `https`, `ws`, `wss`, `tls`
- secure channel set: `https`, `wss`, `tls`
- peer types: desktop client, thin client, authoritative server, node runtime, internal service
- actor types: `user-session`, `node-identity`, `service-identity`

### Trust dimensions

The contracts keep trust dimensions separate:

- user login session trust
- trusted device trust
- trusted node trust
- peer certificate trust

This prevents login state from being treated as equivalent to device trust, and prevents user trust from being treated as equivalent to node trust.

## Fail-closed policy baseline

`TransportSecurityDomain` provides scenario baseline policies that:

- do not allow insecure fallback
- require secure channel types
- require certificate trust checks
- enforce scenario-specific actor and trust posture

Examples:

- desktop control-plane requires authenticated user session plus trusted device
- thin client control-plane requires authenticated user session but keeps device trust separate/optional for this baseline
- node control-plane requires trusted node state and mTLS
- service-to-service requires service identity and mTLS

## Connection decision model

`evaluateTransportConnectionTrust(...)` evaluates connection context against policy and returns a deterministic result:

- `accepted` flag
- explicit rejection reason set
- policy/scenario metadata for host-side auditing

Rejection reasons include:

- invalid policy
- insecure channel / unencrypted transport
- LAN trust assumption (LAN is not trusted by default)
- missing authenticated session
- missing trusted device
- missing trusted node
- missing peer certificate trust
- missing mTLS

## Application ports and use-case seam

`TransportSecurityPorts.ts` defines:

- policy resolution port
- connection policy evaluator port
- optional policy decision audit port

`EvaluateTransportConnectionPolicyUseCase` orchestrates:

- scenario policy resolution (or explicit override)
- trust evaluation
- optional non-blocking decision audit emission

This keeps host transport handlers thin and avoids duplicating trust rules in each host.

Story 7.1.2 adds `ValidateTransportConnectionTrustUseCase` as the centralized trust-validation path that:

- resolves trusted-device state from server-managed registration records
- resolves node trust and revocation posture from node identity persistence
- resolves peer certificate posture from certificate revocation/trust state
- composes resolved trust evidence into one policy evaluation decision
- returns structured failure reasons for audit/logging/safe transport responses

The use case is direction-aware (`inbound` / `outbound`) and scenario-aware so the same path can be reused by multiple hosts and adapters without re-implementing trust checks.

## Adapter guidance

- Parse and normalize inbound connection/auth evidence at transport boundaries.
- Build transport trust validation requests from host/runtime details and invoke `ValidateTransportConnectionTrustUseCase`.
- Use infrastructure trust-state resolvers to load trusted-device/node/certificate posture from server-managed stores.
- Use transport adapter mappings (`HTTP` / `WebSocket`) to convert validation outcomes into protocol-safe responses without exposing sensitive trust internals.
- Treat non-accepted decisions as authoritative rejection outcomes.
- Do not add insecure fallback branches in adapter code paths.

## Boundaries

- Domain/application layers define policy and validation behavior only.
- Infrastructure/hosts remain responsible for:
  - TLS termination mechanics
  - certificate chain parsing
  - session/device/node trust data loading
  - protocol-specific response mapping (HTTP status, WebSocket close codes, etc.)

## Story 7.1.3 host bootstrap wiring

Story 7.1.3 adds explicit host-level transport composition and environment-aware secure defaults in runtime composition roots.

### Host secure transport composition artifacts

- `infrastructure/config/HostSecureTransportConfig.ts`
- `hosts/server/IdentityServerHost.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `electron/main/main.ts`
- `ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`
- `ui/web/identity/resolveWebIdentityApiBaseUrl.ts`
- `infrastructure/runtime/browser-development/BrowserDevelopmentManagedRuntime.ts`

### Runtime behavior updates

- Hosts resolve one shared secure transport config (`HostSecureTransportConfig`) instead of ad hoc endpoint/tls toggles.
- Identity server host now composes `ValidateTransportConnectionTrustUseCase` + `HttpTransportTrustValidationAdapter` in the composition root and injects that gate into `IdentityHttpServer`.
- Authenticated HTTP routes now run inbound transport-trust validation through shared contracts, with explicit node-to-control-plane mapping for node runtime trust-material and heartbeat routes.
- Non-loopback authoritative server startup fails closed unless HTTPS transport material is available.
- Desktop/web/worker transport endpoint resolution now enforces secure endpoints, allowing insecure transport only for explicit loopback-safe host profiles.

## Story 7.1.4 audit and redacted logging integration

Story 7.1.4 extends the transport trust path with explicit audit/log event modeling and redaction-safe emission:

- `TransportSecurityAuditPorts` defines:
  - transport security event taxonomy for accepted and rejected outcomes;
  - best-effort audit sink integration;
  - explicit redaction/sanitization rules for sensitive details.
- `TransportSecurityObservabilityReporter` bridges:
  - `ITransportConnectionPolicyAuditPort` decisions from policy evaluation;
  - transport adapter denial events;
  into one structured, redacted event stream for logs and optional audit sinks.
- `TransportTrustValidationAdapters` now accept an optional security event reporter and emit denial events, including explicit websocket upgrade denial events.
- `IdentityServerHost` composes the shared reporter into:
  - `ValidateTransportConnectionTrustUseCase` (policy decision events),
  - `HttpTransportTrustValidationAdapter` (transport-boundary denial events).

### Event model highlights

- Success events include generic connection acceptance and device-bound session channel establishment.
- Rejection events include untrusted device, revoked node, certificate mismatch handling, websocket upgrade denial, policy-based peer rejection, and general transport rejection.
- Policy decision events carry resolved trust snapshot metadata (user/device/node/certificate posture) so event classification remains centralized and adapter code does not re-implement trust rules.

### Redaction baseline

Transport audit/log sanitization explicitly redacts or masks:

- path-bearing fields;
- prompt-bearing fields;
- tokens/secrets/password/credentials/session-bearing fields;
- certificate/PEM/CSR/chain/raw trust-material fields.

Freeform strings are also sanitized for:

- bearer token patterns;
- secret assignment fragments;
- filesystem path fragments;
- PEM block payloads.

## Story 7.2.1 secure HTTPS adapter posture

Story 7.2.1 hardens the authoritative identity HTTP adapter so production API traffic is fail-closed for insecure transport and route handlers receive standardized channel metadata.

### Runtime adapter updates

- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - adds explicit secure transport adapter config (`requireHttps`, `allowInsecureLoopback`);
  - enforces secure transport for `/api/*` requests before business handlers run;
  - centralizes inbound channel-state extraction (scheme, mTLS/certificate presence, loopback detection, socket addresses);
  - injects authenticated request transport context (connection + trust-routing metadata) into guarded handlers.
- `hosts/server/IdentityServerHost.ts`
  - composes secure transport options from `HostSecureTransportConfig` and injects them into the HTTP adapter.

### Rejection posture

- When secure HTTP is required and the request is neither TLS-protected nor explicitly loopback-allowed, the adapter returns a consistent denial envelope and does not invoke route handlers.
- Authenticated routes keep the existing trust-validator path; the new secure transport gate runs first and remains independent from UI concerns.

### Tests

- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerTransportTrust.test.ts` now covers:
  - fail-closed insecure API rejection when HTTPS is required;
  - explicit loopback fallback allowance behavior;
  - authenticated-route access to normalized transport context via request logging payload.
