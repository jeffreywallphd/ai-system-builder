# AI Companion: Transport Security Foundation

## Purpose

Story 7.1.1 + 7.1.2 baseline for Feature 7 / Epic 7.1: secure transport src/domain/application contracts plus centralized trust-state validation for HTTPS/WSS/TLS connection acceptance decisions.

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
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts`

## Story 7.3.1 node-to-server mutually authenticated transport adapter

Story 7.3.1 adds a dedicated node-to-server HTTP transport adapter path for certificate-authenticated channels so node runtime operations do not depend on user-session transport flows.

### Runtime adapter updates

- `src/infrastructure/transport/http-server/identity/NodeMutualTlsTransportAdapter.ts`
  - centralizes node mTLS transport validation by composing:
    - `HttpTransportTrustValidationAdapter` (policy + mTLS/certificate trust gate),
    - node certificate identity resolution (`resolveNodeMutualTlsTransportIdentity(...)`) against trusted node records.
  - returns protocol-safe accepted/rejected outcomes with explicit status mapping.
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - adds `requireAuthenticatedNodeTransport(...)` for node-only endpoints (`/runtime-trust-material`, `/heartbeat`);
  - uses the node mTLS adapter whenever transport trust enforcement is configured;
  - keeps a legacy authenticated-session fallback only when transport trust is not configured in runtime composition.
- `src/application/nodes/use-cases/ResolveNodeMutualTlsTransportIdentityUseCase.ts`
  - validates node lifecycle trust eligibility (`approved` + `trusted` + non-revoked + certificate-assigned),
  - validates presented certificate serial/fingerprint against node certificate binding metadata.
- `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
  - adds `resolveNodeMutualTlsTransportIdentity(...)` as the application-facing seam consumed by the transport adapter.
- `src/hosts/server/IdentityServerHost.ts`
  - composes `ResolveNodeMutualTlsTransportIdentityUseCase` into `NodeTrustBackendApi`;
  - configures managed TLS server startup with client certificate requests (`requestCert: true`) for mTLS-capable channels.

### Test coverage updates

- `src/infrastructure/transport/http-server/identity/tests/NodeMutualTlsTransportAdapter.test.ts`
  - covers approved, revoked, and untrusted certificate channel outcomes.
- `src/application/nodes/tests/ResolveNodeMutualTlsTransportIdentityUseCase.test.ts`
  - covers trusted match acceptance, revoked-node rejection, unknown-node rejection, and certificate mismatch rejection.

## Story 7.3.2 additions

- Extends authenticated node runtime routes on the same secure channel:
  - `POST /api/v1/nodes/:nodeId/heartbeat`
  - `POST /api/v1/nodes/:nodeId/operational-update`
- Both routes continue to use `requireAuthenticatedNodeTransport(...)` and therefore:
  - require node mTLS trust validation when transport trust enforcement is enabled;
  - keep transport-authenticated node identity authoritative over payload-claimed identities.

## Story 1.2.4 node route authentication utilities for HTTP transport modularization

Story 1.2.4 extracts node-route authentication and trust-context shaping into shared HTTP transport middleware utilities so node-originated route handlers can rely on one normalized node-auth context path instead of embedding low-level checks.

### Canonical files

- `src/infrastructure/transport/http-server/identity/middleware/node-route-authentication.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/NodeRouteAuthenticationMiddleware.test.ts`

### Modularized route-auth behavior

- required node-id validation for node-originated route scopes is centralized (`resolveRequiredNodeRouteNodeId(...)`);
- session-backed node principal authorization is centralized and reusable (`authorizeSessionNodeRoutePrincipal(...)`);
- mTLS node trust result mapping into normalized route context is centralized (`resolveMutualTlsNodeRouteTransportContext(...)`);
- route handlers continue to consume `requireAuthenticatedNodeTransport(...)`, but low-level node auth/trust derivation now lives in dedicated shared middleware utilities.

## Story 7.3.3 policy-gated node-to-node secure communication seam

Story 7.3.3 adds a dedicated node-peer channel seam so direct node-to-node communication is explicit, authenticated, and disabled by default unless policy rules allow a specific operation class.

### Canonical files

- `src/domain/security/TransportSecurityDomain.ts`
- `src/application/security/ports/NodePeerCommunicationPolicyPorts.ts`
- `src/application/security/use-cases/AuthorizeNodePeerCommunicationUseCase.ts`
- `src/infrastructure/transport/StaticNodePeerCommunicationPolicyResolver.ts`
- `src/infrastructure/transport/NodePeerCertificateIdentityResolver.ts`
- `src/infrastructure/transport/NodePeerTransportValidationAdapter.ts`

### Runtime behavior

- Adds `node-to-node` baseline scenario (`transport-policy:node-peer:v1`) requiring:
  - secure encrypted channel;
  - mTLS;
  - trusted node posture;
  - trusted peer certificate posture.
- Adds explicit application-layer node-peer policy + identity contracts:
  - operation-class allow-list;
  - capability exposure list;
  - optional explicit remote-peer allow-list;
  - certificate-bound peer identity + trust lifecycle result.
- Adds `AuthorizeNodePeerCommunicationUseCase` that composes:
  - policy gate,
  - shared transport trust validation,
  - peer certificate identity/approval/trust/revocation checks.
- Adds production-oriented infrastructure seams:
  - static explicit pair policy resolver (no matching rule => deny),
  - node certificate identity resolver backed by node trust persistence,
  - transport adapter mapping authorization outcomes to protocol-safe responses.

### Initial constrained operation

- operation class: `runtime-trust-material-replication`
- capability: `runtime-trust-material:read`
- broad peer mesh behavior is not introduced.

### Test coverage

- `src/application/security/tests/AuthorizeNodePeerCommunicationUseCase.test.ts`
- `src/infrastructure/transport/tests/StaticNodePeerCommunicationPolicyResolver.test.ts`
- `src/infrastructure/transport/tests/NodePeerCertificateIdentityResolver.test.ts`
- `src/infrastructure/transport/tests/NodePeerTransportValidationAdapter.test.ts`

## Story 7.3.4 transport lifecycle resilience and trust-invalidated channel handling

Story 7.3.4 extends secure channel behavior beyond initial handshake acceptance so long-lived channels are continuously trust-aware and fail closed when trust state changes.

### Runtime lifecycle additions

- `src/infrastructure/transport/websocket/SecureWebSocketChannelContext.ts`
  - adds explicit websocket channel lifecycle vocabulary (`active`, `revalidating`, `reconnect-pending`, `invalidated`, `closed`);
  - adds reconnect directive + bounded backoff policy helpers;
  - adds certificate-binding normalization and rotation-detection helpers used by long-lived channels.
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - adds websocket lifecycle monitor hooks for accepted channels:
    - periodic trust/session revalidation for active channels;
    - revocation/trust-invalidation-triggered channel shutdown (fail closed);
    - certificate-rotation awareness with invalidation + reconnect guidance;
    - structured lifecycle event logging + optional lifecycle callback for host observers.
- `src/infrastructure/transport/http-server/identity/NodeMutualTlsTransportAdapter.ts`
  - adds node-channel lifecycle metadata in adapter outcomes:
    - certificate rotation awareness against prior cert binding metadata;
    - explicit reconnect directives (deny on revoked/policy failures, bounded retry guidance for transient failures).

### Lifecycle posture

- Long-lived websocket channels are no longer treated as permanently trusted after upgrade; trust is revalidated on an interval when transport trust enforcement is active.
- Revoked/invalidated trust closes active channels instead of silently allowing stale channels to remain active.
- Reconnect behavior is explicit and policy-aware via reconnect directives (allowed/denied + bounded delay guidance).

### Test coverage

- `src/infrastructure/transport/websocket/tests/SecureWebSocketChannelContext.test.ts`
  - certificate rotation detection,
  - reconnect directive/backoff classification,
  - lifecycle transition safety.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts`
  - revocation-triggered invalidation of accepted websocket channels,
  - rotation-triggered invalidation with lifecycle event reason assertions.
- `src/infrastructure/transport/http-server/identity/tests/NodeMutualTlsTransportAdapter.test.ts`
  - node mTLS lifecycle reconnect guidance and rotation-awareness behavior.

## Core contract model

- Scenarios:
- `desktop-client-to-control-plane`
- `thin-client-to-control-plane`
- `node-to-control-plane`
- `node-to-node`
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

- `src/infrastructure/config/HostSecureTransportConfig.ts` central host transport profile resolution (`server`, `desktop`, `hybrid`, `web`, `worker`) and secure endpoint assertions.
  - runtime env lookup is now browser-safe (`globalThis.process?.env`) so web compositions can resolve fail-closed defaults even when the Node `process` global is absent.
- `src/hosts/server/IdentityServerHost.ts` composes:
  - `ServerManagedTransportTrustStateResolver`
  - `ValidateTransportConnectionTrustUseCase`
  - `HttpTransportTrustValidationAdapter`
  and injects the resulting gate into `IdentityHttpServer`.
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` now supports optional inbound authenticated-route transport trust validation with scenario/peer mapping, including node-path specific `node-to-control-plane` mapping.
- `electron/main/main.ts`, `src/ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`, `src/ui/web/identity/resolveWebIdentityApiBaseUrl.ts`, and `src/infrastructure/runtime/browser-development/BrowserDevelopmentManagedRuntime.ts` now consume shared host transport config for endpoint safety checks.

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

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - adds explicit secure transport adapter config (`requireHttps`, `allowInsecureLoopback`);
  - enforces secure transport for `/api/*` requests before business handlers run;
  - centralizes inbound channel-state extraction (scheme, mTLS/certificate presence, loopback detection, socket addresses);
  - injects authenticated request transport context (connection + trust-routing metadata) into guarded handlers.
- `src/hosts/server/IdentityServerHost.ts`
  - composes secure transport options from `HostSecureTransportConfig` and injects them into the HTTP adapter.

### Rejection posture

- When secure HTTP is required and the request is neither TLS-protected nor explicitly loopback-allowed, the adapter returns a consistent denial envelope and does not invoke route handlers.
- Authenticated routes keep the existing trust-validator path; the new secure transport gate runs first and remains independent from UI concerns.

### Tests

- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerTransportTrust.test.ts` now covers:
  - fail-closed insecure API rejection when HTTPS is required;
  - explicit loopback fallback allowance behavior;
  - authenticated-route access to normalized transport context via request logging payload.

## Story 7.2.2 secure websocket upgrade and session-bound channels

Story 7.2.2 adds an upgrade gate for runtime websocket channels so accepted sockets are bound to authenticated session/device identity and transport trust posture before channel use.

### Runtime adapter updates

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - adds explicit websocket upgrade handling on `/ws` routes;
  - validates websocket handshake headers (`Upgrade`, `Connection`, `Sec-WebSocket-*`) before upgrade;
  - enforces secure websocket transport posture (`requireWss`, loopback policy);
  - resolves and validates authenticated session context for upgrade requests;
  - routes websocket trust validation through `WebSocketTransportTrustValidationAdapter` when transport trust enforcement is active;
  - emits structured, auditable denial envelopes for handshake/auth/trust/purpose failures;
  - constructs session-bound websocket channel context with actor/session/device metadata, workspace scope, purpose, and capabilities.
- `src/hosts/server/IdentityServerHost.ts`
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

- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts` covers:
  - secure websocket enforcement rejection;
  - missing-auth websocket upgrade rejection;
  - transport-trust websocket denial mapping;
  - unsupported purpose rejection;
  - accepted upgrade creation of session-bound channel context.
- `src/infrastructure/transport/websocket/tests/SecureWebSocketChannelContext.test.ts` covers:
  - purpose parsing and capability mapping;
  - channel-context construction with actor/transport metadata;
  - channel registry registration and release lifecycle.

## Story 7.2.3 desktop trusted-device channel bootstrap + pinned trust handling

Story 7.2.3 adds desktop-side transport bootstrap behavior so desktop client channels are bound to explicit trusted-device registration + pinned trust material instead of generic LAN assumptions.

### Runtime additions

- `electron/src/shared/DesktopContracts.ts`
  - desktop bootstrap context now includes `identityTransportTrust` with:
    - trust enforcement posture (`required` / `optional`);
    - trusted-device registration binding metadata;
    - pinned trust-material registration metadata.
- `electron/main/main.ts`
  - desktop host resolves `identityTransportTrust` from secure desktop storage/env-backed host config and injects it into preload bootstrap context.
- `src/infrastructure/security/DesktopTrustedDeviceTransportBootstrap.ts`
  - central desktop trust-bootstrap resolver + ports:
    - bootstrap-context port (`IDesktopTrustedDeviceBootstrapPort`);
    - clock port (`IDesktopTrustedDeviceBootstrapClockPort`);
    - deterministic bootstrap state model (`ready` / `not-required` / `failed` with actionable reason codes).
- `src/infrastructure/transport/http-client/DesktopTrustedDeviceIdentityAuthClient.ts`
  - desktop-aware auth client wrapper that:
    - blocks login when required trust bootstrap fails;
    - injects trusted-device binding into desktop login requests and requires trusted session issuance;
    - distinguishes credential success from trusted-device session assurance (fail-closes untrusted issued sessions).

### Failure-state posture

- Bootstrap failures are surfaced as structured trust-failure reasons in API error envelopes (`registration-missing`, `pinned-trust-material-missing`, `pinned-trust-material-expired`, `session-assurance-not-trusted`) without returning raw trust-material values.
- Desktop login UX can show actionable remediation guidance while transport/bootstrap internals remain outside page/presentation composition.

### Tests

- `src/infrastructure/security/tests/DesktopTrustedDeviceTransportBootstrap.test.ts`
  - covers required/optional bootstrap posture, missing registration, missing pin, expired pin, and ready-state resolution.
- `src/infrastructure/transport/http-client/tests/DesktopTrustedDeviceIdentityAuthClient.test.ts`
  - covers bootstrap-failure channel blocking, trust-context login injection, post-login trust-assurance gating, and non-required passthrough behavior.

## Story 7.2.4 thin-client secure session channels for browser/mobile

Story 7.2.4 makes thin-client browser/mobile session channels explicit and secure without requiring desktop-specific pairing semantics.

### Shared contract additions

- `src/shared/contracts/security/ThinClientTransportContracts.ts`
  - thin-client channel context vocabulary (`browser`, `mobile-browser`, `mobile-webview`, `unknown`);
  - browser/mobile channel projection helper for authenticated request context;
  - websocket origin policy evaluator for thin-client upgrade enforcement.

### Host transport behavior updates

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - transport-trust scenario now defaults from authenticated session channel (`desktop` -> desktop scenario, `thin-client` -> thin-client scenario);
  - insecure loopback trust-validation bypass is now desktop-scenario-only (thin-client requests do not bypass);
  - authenticated route context now includes normalized channel metadata (`transport.channel`) with thin-client browser/mobile details;
  - thin-client websocket upgrades now require allowed origin policy (origin present, host aligned, secure scheme posture with loopback-safe local exception).

### Test coverage updates

- `src/shared/contracts/security/tests/ThinClientTransportContracts.test.ts`
  - validates form-factor classification and origin policy mapping.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerTransportTrust.test.ts`
  - validates thin-client anti-bypass, desktop bypass continuity, scenario routing, and authenticated channel context propagation.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts`
  - validates thin-client websocket origin rejection and thin-client accepted upgrade routing when origin policy passes.

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`

