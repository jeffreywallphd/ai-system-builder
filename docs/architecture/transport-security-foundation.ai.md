# AI Companion: Transport Security Foundation

## Purpose

Story 7.1.1 + 7.1.2 baseline for Feature 7 / Epic 7.1: secure transport domain/application contracts plus centralized trust-state validation for HTTPS/WSS/TLS connection acceptance decisions.

## Canonical files

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
- `src/infrastructure/transport/websocket/SecureWebSocketChannelContext.ts`
- `src/infrastructure/transport/websocket/tests/SecureWebSocketChannelContext.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts`

## Core contract model

- Scenarios:
  - `desktop-client-to-control-plane`
  - `thin-client-to-control-plane`
  - `node-to-control-plane`
  - `service-to-service`
- Channel vocabulary:
  - modeled: `http`, `https`, `ws`, `wss`, `tls`
  - secure set: `https`, `wss`, `tls`
- Actor vocabulary:
  - `user-session`
  - `node-identity`
  - `service-identity`
- Peer vocabulary:
  - desktop client, thin client, authoritative server, node runtime, internal service

## Trust split enforced

Transport contracts explicitly keep these separate:

- login/session trust
- trusted-device trust
- node trust
- peer certificate trust

Login success is not treated as device trust.
User trust is not treated as node trust.

## Fail-closed baseline posture

- LAN is not trusted by default (`lanTrustAssumed` triggers rejection).
- Insecure fallback is not modeled as an accepted path.
- Insecure channels and unencrypted transport are rejected.
- Scenario policies are explicit and distinct for desktop/thin-client/node/service paths.

## Application seams

- `ITransportSecurityPolicyResolverPort`
- `ITransportConnectionPolicyEvaluatorPort`
- `ITransportConnectionPolicyAuditPort` (optional, non-blocking)
- `EvaluateTransportConnectionPolicyUseCase` composes policy resolve + trust decision + audit event.
- `TransportTrustValidationPorts` adds trust-state resolution seams for:
  - trusted-device metadata/state
  - node trust/revocation/certificate posture
  - peer certificate revocation/trust posture
- `ValidateTransportConnectionTrustUseCase` is the centralized flow that resolves trust state and then performs one policy decision with structured rejection reasons.

## Adapter usage guidance

- Construct `TransportConnectionContext` at transport boundary from request/session/cert evidence.
- Prefer invoking `ValidateTransportConnectionTrustUseCase` from host adapters so state-resolution + policy evaluation stay centralized.
- Use transport adapters (`HTTP` / `WebSocket`) to map validation outcomes to safe protocol responses.
- Map rejection reasons to host-level response semantics (HTTP/WS/service) without re-implementing trust rules in each host.

## Test coverage in this slice

- domain baseline policy + rejection rules
- application orchestration and audit behavior
- centralized trust-state resolution + validation scenarios
- transport adapter mapping behavior for accepted vs denied trust decisions
- shared DTO contract projection and validation guards

## Story 7.1.3 host composition update

Story 7.1.3 wires these transport contracts into runnable hosts through explicit composition-root config:

- `infrastructure/config/HostSecureTransportConfig.ts` central host transport profile resolution (`server`, `desktop`, `hybrid`, `web`, `worker`) and secure endpoint assertions.
- `hosts/server/IdentityServerHost.ts` composes:
  - `ServerManagedTransportTrustStateResolver`
  - `ValidateTransportConnectionTrustUseCase`
  - `HttpTransportTrustValidationAdapter`
  and injects the resulting gate into `IdentityHttpServer`.
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts` now supports optional inbound authenticated-route transport trust validation with scenario/peer mapping, including node-path specific `node-to-control-plane` mapping.
- `electron/main/main.ts`, `ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`, `ui/web/identity/resolveWebIdentityApiBaseUrl.ts`, and `infrastructure/runtime/browser-development/BrowserDevelopmentManagedRuntime.ts` now consume shared host transport config for endpoint safety checks.

Fail-closed additions:

- non-loopback authoritative server startup now fails when HTTPS is required but managed TLS material is unavailable;
- insecure remote HTTP/WS endpoints are rejected by default outside loopback-safe host profiles.

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

## Story 7.2.2 secure websocket upgrade and session-bound channels

Story 7.2.2 adds an upgrade gate for runtime websocket channels so accepted sockets are bound to authenticated session/device identity and transport trust posture before channel use.

### Runtime adapter updates

- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - adds explicit websocket upgrade handling on `/ws` routes;
  - validates websocket handshake headers (`Upgrade`, `Connection`, `Sec-WebSocket-*`) before upgrade;
  - enforces secure websocket transport posture (`requireWss`, loopback policy);
  - resolves and validates authenticated session context for upgrade requests;
  - routes websocket trust validation through `WebSocketTransportTrustValidationAdapter` when transport trust enforcement is active;
  - emits structured, auditable denial envelopes for handshake/auth/trust/purpose failures;
  - constructs session-bound websocket channel context with actor/session/device metadata, workspace scope, purpose, and capabilities.
- `hosts/server/IdentityServerHost.ts`
  - composes `WebSocketTransportTrustValidationAdapter` and wires websocket trust validation into the identity server host composition.
- `src/infrastructure/transport/websocket/SecureWebSocketChannelContext.ts`
  - defines websocket purpose/capability taxonomy for status, queue monitoring, run monitoring, and stream-control channels;
  - provides immutable channel-context construction and in-memory channel registry lifecycle helpers (register on accepted upgrade, release on socket close).

### Denial posture

- Unauthorized upgrades are rejected with structured `authentication-failed` denial metadata.
- Downgraded or insecure websocket attempts are rejected with `secure-transport-required`.
- Transport-trust denial responses include mapped websocket close semantics for audit and protocol-safe handling.
- Unsupported channel-purpose requests are rejected before upgrade establishment.

### Tests

- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts` covers:
  - secure websocket enforcement rejection;
  - missing-auth websocket upgrade rejection;
  - transport-trust websocket denial mapping;
  - unsupported purpose rejection;
  - accepted upgrade creation of session-bound channel context.
- `src/infrastructure/transport/websocket/tests/SecureWebSocketChannelContext.test.ts` covers:
  - purpose parsing and capability mapping;
  - channel-context construction with actor/transport metadata;
  - channel registry registration and release lifecycle.
