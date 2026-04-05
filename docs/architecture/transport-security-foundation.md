# Transport Security Foundation

This document describes the Story 7.1.1 transport security contract baseline for Feature 7 / Epic 7.1.

## Scope

The slice introduces shared domain and application contracts for secure runtime transport decisions across:

- desktop client to control-plane
- thin client to control-plane
- trusted node to control-plane
- service-to-service control-plane channels

It does not add host-specific HTTP/TLS adapter behavior yet. It defines the interfaces those adapters should consume.

## Canonical artifacts

- `src/domain/security/TransportSecurityDomain.ts`
- `src/application/security/ports/TransportSecurityPorts.ts`
- `src/application/security/use-cases/EvaluateTransportConnectionPolicyUseCase.ts`
- `src/shared/contracts/security/TransportSecurityContracts.ts`
- `src/domain/security/tests/TransportSecurityDomain.test.ts`
- `src/application/security/tests/EvaluateTransportConnectionPolicyUseCase.test.ts`
- `src/shared/contracts/security/tests/TransportSecurityContracts.test.ts`

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

## Adapter guidance

- Parse and normalize inbound connection/auth evidence at transport boundaries.
- Build `TransportConnectionContext` from host/runtime details.
- Invoke `EvaluateTransportConnectionPolicyUseCase` before accepting HTTP/WebSocket/service channels.
- Treat non-accepted decisions as authoritative rejection outcomes.
- Do not add insecure fallback branches in adapter code paths.

## Boundaries

- Domain/application layers define policy and validation behavior only.
- Infrastructure/hosts remain responsible for:
  - TLS termination mechanics
  - certificate chain parsing
  - session/device/node trust data loading
  - protocol-specific response mapping (HTTP status, WebSocket close codes, etc.)
