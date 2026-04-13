# AI Companion: Auth-Only Server Startup Contract

Feature: B  
Epic: B.1  
Story: B.1.1

## Purpose

Define the server contract required before desktop login under the persistent control-plane model.

This contract reflects the current startup path where Electron main binds the authoritative control-plane host once for the desktop session and exposes auth-critical behavior first, then activates broader capabilities during post-login warmup.

## Required pre-login server contract

- Required identity route family: `identity-auth` (`/api/v1/identity/*`).
- Required endpoints for renderer auth/session bootstrap:
  - `POST /api/v1/identity/login`
  - `POST /api/v1/identity/dev-login` (dev only)
  - `POST /api/v1/identity/register` (when local registration is enabled)
  - `GET /api/v1/identity/session`
  - `GET /api/v1/identity/session/context`
- Required trust/session behavior:
  - enforce desktop trusted-session requirements (`sessionTrustRequirement: "require-trusted"`)
  - validate trusted-device binding markers
  - return trust/session metadata consumed by renderer bootstrap
- Required persistence responsibility:
  - identity account/credential/session state
  - trusted-device and pairing state
  - workspace actor-context data needed by session-context hydration

## Deferred from pre-login

Non-auth capability families remain unavailable until post-login lifecycle activation.

## Current startup contract

- Pre-login startup binds the authoritative control-plane host once (`startAuthoritativeServerHostAssembly(...)`).
- Transport continuity is preserved across login state changes; warmup does not stop/rebind the listener.
- Post-login warmup activates deferred runtime capabilities through explicit capability activation (`activateCapabilities(...)`) instead of host replacement.

## Required outputs to Electron main

- host `address` used to derive `controlPlaneBaseUrl` / `identityApiBaseUrl`
- lifecycle stop handle
- startup success/failure signal
- optional startup diagnostics correlation id

## Boundary target

- Pre-login: identity/session bootstrap behavior available on the already-bound authoritative host.
- Post-login: deferred runtime capabilities activated through lifecycle contracts, not socket handoff.

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`
