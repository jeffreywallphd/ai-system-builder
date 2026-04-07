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

### Tests

- `src/infrastructure/transport/http-server/identity/tests/NodeMutualTlsTransportAdapter.test.ts`
  - covers approved, revoked, and untrusted certificate channel outcomes.
- `src/application/nodes/tests/ResolveNodeMutualTlsTransportIdentityUseCase.test.ts`
  - covers trusted match acceptance, revoked-node rejection, unknown-node rejection, and certificate mismatch rejection.

## Story 7.3.2 secure node heartbeat and capability exchange channel contracts

Story 7.3.2 extends the same authenticated node channel posture introduced in Story 7.3.1 to routine node operational exchanges:

- `POST /api/v1/nodes/:nodeId/heartbeat`
- `POST /api/v1/nodes/:nodeId/operational-update`

Transport and identity posture:

- both routes are guarded through `requireAuthenticatedNodeTransport(...)`;
- when transport trust enforcement is enabled, both routes require node mTLS validation (`ValidateTransportConnectionTrustUseCase` + node certificate identity resolution);
- transport-authenticated node identity remains authoritative, so payload-claimed node/actor identifiers are not trusted as identity sources.

## Story 7.3.3 policy-gated node-to-node secure communication seam

Story 7.3.3 introduces the explicit node-peer transport seam so direct node-to-node communication is not ad hoc and is denied unless explicitly policy-enabled for a constrained operation class.

### Runtime seam updates

- `src/domain/security/TransportSecurityDomain.ts`
  - adds `node-to-node` scenario baseline (`transport-policy:node-peer:v1`);
  - requires secure channel, encrypted transport, mTLS, trusted node state, and peer certificate trust for node-peer transport validation.
- `src/application/security/ports/NodePeerCommunicationPolicyPorts.ts`
  - defines application policy + identity seams for node-peer channels:
    - explicit operation classes;
    - explicit peer capabilities;
    - certificate-bound peer identity and trust posture result contract.
- `src/application/security/use-cases/AuthorizeNodePeerCommunicationUseCase.ts`
  - composes node-peer policy resolution, shared transport trust validation, and peer certificate identity checks;
  - fail-closed posture:
    - peer channels disabled by default,
    - operation class must be explicitly allowed,
    - optional explicit peer-node allow-list is enforced,
    - certificate identity binding + approval/trust/revocation posture must satisfy policy.
- `src/infrastructure/transport/StaticNodePeerCommunicationPolicyResolver.ts`
  - production-oriented policy resolver implementation with explicit local/remote pair rules;
  - no rules means default deny.
- `src/infrastructure/transport/NodePeerCertificateIdentityResolver.ts`
  - resolves peer node trust lifecycle and validates certificate serial/fingerprint binding against node records.
- `src/infrastructure/transport/NodePeerTransportValidationAdapter.ts`
  - maps node-peer authorization outcomes to protocol-safe transport results (`400`, `403`, `500`).

### Initial constrained use case

- Operation class: `runtime-trust-material-replication`
- Capability exposure: `runtime-trust-material:read`
- This does not create a broad mesh; channels remain explicit rule-based pairings.

### Test coverage updates

- `src/application/security/tests/AuthorizeNodePeerCommunicationUseCase.test.ts`
- `src/infrastructure/transport/tests/StaticNodePeerCommunicationPolicyResolver.test.ts`
- `src/infrastructure/transport/tests/NodePeerCertificateIdentityResolver.test.ts`
- `src/infrastructure/transport/tests/NodePeerTransportValidationAdapter.test.ts`

## Story 7.3.4 transport lifecycle resilience and trust-invalidated channel handling

Story 7.3.4 extends secure channel behavior beyond initial handshake acceptance so long-lived channels remain trust-aware and fail closed when trust state changes.

### Runtime lifecycle additions

- `src/infrastructure/transport/websocket/SecureWebSocketChannelContext.ts`
  - adds explicit websocket channel lifecycle vocabulary (`active`, `revalidating`, `reconnect-pending`, `invalidated`, `closed`);
  - adds reconnect directive + bounded backoff policy helpers;
  - adds certificate-binding normalization and rotation-detection helpers for long-lived channels.
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - adds websocket lifecycle monitor hooks for accepted channels:
    - periodic trust/session revalidation for active channels;
    - revocation/trust-invalidation-triggered channel shutdown (fail closed);
    - certificate-rotation awareness with invalidation + reconnect guidance;
    - structured lifecycle event logging + optional lifecycle callback for host observers.
- `src/infrastructure/transport/http-server/identity/NodeMutualTlsTransportAdapter.ts`
  - adds node-channel lifecycle metadata in adapter outcomes:
    - certificate rotation awareness against prior cert-binding metadata;
    - explicit reconnect directives (deny on revoked/policy failures, bounded retry guidance for transient failures).

### Lifecycle posture

- Long-lived websocket channels are no longer treated as permanently trusted after upgrade; trust is revalidated on an interval when transport trust enforcement is active.
- Revoked/invalidated trust closes active channels instead of silently allowing stale channels to remain active.
- Reconnect behavior is explicit and policy-aware via reconnect directives (allowed/denied + bounded delay guidance).

### Tests

- `src/infrastructure/transport/websocket/tests/SecureWebSocketChannelContext.test.ts`
  - certificate rotation detection,
  - reconnect directive/backoff classification,
  - lifecycle transition safety.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts`
  - revocation-triggered invalidation of accepted websocket channels,
  - rotation-triggered invalidation with lifecycle event reason assertions.
- `src/infrastructure/transport/http-server/identity/tests/NodeMutualTlsTransportAdapter.test.ts`
  - node mTLS lifecycle reconnect guidance and rotation-awareness behavior.

## Domain vocabulary

### Scenarios

- `desktop-client-to-control-plane`
- `thin-client-to-control-plane`
- `node-to-control-plane`
- `node-to-node`
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

- `src/infrastructure/config/HostSecureTransportConfig.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `electron/main/main.ts`
- `src/ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`
- `src/ui/web/identity/resolveWebIdentityApiBaseUrl.ts`
- `src/infrastructure/runtime/browser-development/BrowserDevelopmentManagedRuntime.ts`

### Runtime behavior updates

- Hosts resolve one shared secure transport config (`HostSecureTransportConfig`) instead of ad hoc endpoint/tls toggles.
- `HostSecureTransportConfig` resolves runtime env from a browser-safe `globalThis.process?.env` probe so web runtime composition does not depend on Node globals.
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

## Story 7.2.3 desktop trusted-device channel bootstrap and pinned trust handling

Story 7.2.3 adds desktop-side transport bootstrap behavior so desktop client channels are bound to explicit trusted-device registration and pinned trust material rather than generic LAN assumptions.

### Runtime additions

- `electron/src/shared/DesktopContracts.ts`
  - desktop bootstrap context now includes `identityTransportTrust` with:
    - trust enforcement posture (`required` / `optional`);
    - trusted-device registration binding metadata;
    - pinned trust-material registration metadata.
- `electron/main/main.ts`
  - desktop host resolves `identityTransportTrust` from secure desktop storage/env-backed host configuration and injects it into preload bootstrap context.
- `src/infrastructure/security/DesktopTrustedDeviceTransportBootstrap.ts`
  - central desktop trust-bootstrap resolver + ports:
    - bootstrap-context port (`IDesktopTrustedDeviceBootstrapPort`);
    - clock port (`IDesktopTrustedDeviceBootstrapClockPort`);
    - deterministic bootstrap state model (`ready` / `not-required` / `failed` with actionable reason codes).
- `src/infrastructure/transport/http-client/DesktopTrustedDeviceIdentityAuthClient.ts`
  - desktop-aware auth client wrapper that:
    - blocks login when required trust bootstrap fails;
    - injects trusted-device binding into desktop login requests and requires trusted session issuance;
    - distinguishes credential success from trusted-device session assurance (fail-closed for untrusted issued sessions).

### Failure-state posture

- Bootstrap failures are surfaced as structured trust-failure reasons in API error envelopes (`registration-missing`, `pinned-trust-material-missing`, `pinned-trust-material-expired`, `session-assurance-not-trusted`) without returning raw trust-material values.
- Desktop login UX can show actionable remediation guidance while transport/bootstrap internals stay out of page-level presentation composition.

### Tests

- `src/infrastructure/security/tests/DesktopTrustedDeviceTransportBootstrap.test.ts`
  - covers required/optional bootstrap posture, missing registration, missing pin, expired pin, and ready-state resolution.
- `src/infrastructure/transport/http-client/tests/DesktopTrustedDeviceIdentityAuthClient.test.ts`
  - covers bootstrap-failure channel blocking, trust-context login injection, post-login trust-assurance gating, and non-required passthrough behavior.

## Story 7.2.4 thin-client secure session channels for browser and mobile

Story 7.2.4 formalizes thin-client browser/mobile channel behavior so thin-client runtime paths stay secure without inheriting desktop pairing assumptions.

### Shared thin-client contracts

- `src/shared/contracts/security/ThinClientTransportContracts.ts`
  - defines thin-client channel context projection (`browser`, `mobile-browser`, `mobile-webview`, `unknown`);
  - provides origin-policy evaluation helpers for thin-client websocket upgrade acceptance;
  - keeps browser/mobile session-channel expectations reusable by host adapters.

### Runtime adapter updates

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - derives transport-routing scenario from authenticated session channel (`desktop` vs `thin-client`) so transport validation is session-aware by default;
  - enforces anti-bypass posture by limiting insecure loopback transport-trust bypass to desktop scenario only;
  - injects normalized authenticated channel context (`transport.channel`) into request handler context/log payloads, including thin-client browser/mobile metadata;
  - enforces thin-client websocket origin policy during upgrade handling (required origin, expected host match, secure scheme posture with loopback-safe HTTP exception).

### Tests

- `src/shared/contracts/security/tests/ThinClientTransportContracts.test.ts`
  - covers thin-client form-factor classification, channel-context projection, and websocket origin-policy evaluation.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerTransportTrust.test.ts`
  - covers no trust-bypass for thin-client loopback sessions, desktop-only bypass continuity, desktop/thin-client scenario routing, and authenticated transport channel-context logging.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts`
  - covers thin-client websocket origin rejection and accepted thin-client websocket routing with valid origin.

