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

## Runtime capability guard behavior

- Runtime route families (`system-runtime`, `run-submission`, `run-read`, `run-mutation`, `run-execution-update`, `image-run-api`) are guarded by one centralized backend capability guard at the identity HTTP transport boundary.
- In desktop startup, guarded route-family availability resolves from one lifecycle source: the post-login runtime status store capability phase (`pre-login`, `warming`, `ready`, `failed`) passed into server-host composition as a runtime lifecycle status provider.
- When deferred runtime capability state is not ready, guarded endpoints return canonical lifecycle contracts (`runtime-availability-response/v1`) using explicit `unavailable`, `warming`, or `failed` state responses instead of transport-level outages.
- Once capability state becomes available, the same handlers execute normally with no per-handler lifecycle branching.

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
