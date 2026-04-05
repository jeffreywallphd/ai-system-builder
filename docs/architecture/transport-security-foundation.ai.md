# AI Companion: Transport Security Foundation

## Purpose

Story 7.1.1 baseline for Feature 7 / Epic 7.1: secure transport domain/application contracts for HTTPS/WSS/TLS connection acceptance decisions.

## Canonical files

- `src/domain/security/TransportSecurityDomain.ts`
- `src/application/security/ports/TransportSecurityPorts.ts`
- `src/application/security/use-cases/EvaluateTransportConnectionPolicyUseCase.ts`
- `src/shared/contracts/security/TransportSecurityContracts.ts`
- `src/domain/security/tests/TransportSecurityDomain.test.ts`
- `src/application/security/tests/EvaluateTransportConnectionPolicyUseCase.test.ts`
- `src/shared/contracts/security/tests/TransportSecurityContracts.test.ts`

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

## Adapter usage guidance

- Construct `TransportConnectionContext` at transport boundary from request/session/cert evidence.
- Resolve/evaluate policy before accepting channel.
- Map rejection reasons to host-level response semantics (HTTP/WS/service) without re-implementing trust rules in each host.

## Test coverage in this slice

- domain baseline policy + rejection rules
- application orchestration and audit behavior
- shared DTO contract projection and validation guards
