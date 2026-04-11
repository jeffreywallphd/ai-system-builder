# AI Companion: Auth-Only Server Startup Contract

Feature: B  
Epic: B.1  
Story: B.1.1

## Purpose
- Define the exact server contract required before desktop login.
- Lock the pre-login boundary so later auth-minimal host stories can implement directly.

## Required pre-login server contract
- Required identity route family: `identity-auth` (`/api/v1/identity/*`).
- Required endpoints for renderer auth/session bootstrap:
  - `POST /api/v1/identity/login`
  - `POST /api/v1/identity/dev-login` (dev only)
  - `POST /api/v1/identity/register` (when local registration is enabled)
  - `GET /api/v1/identity/session`
  - `GET /api/v1/identity/session/context`
- Required trust/session behavior:
  - honor desktop trusted-session requirement (`sessionTrustRequirement: "require-trusted"`)
  - validate trusted-device binding markers
  - return trust/session metadata consumed by renderer bootstrap
- Required persistence responsibility:
  - identity account/credential/session state
  - trusted-device + pairing state
  - workspace actor-context read data needed by session-context hydration

## Deferred from pre-login
- Route families not required for login/session bootstrap and targeted for defer:
  - `workspace-invitations`
  - `workspace-administration` (management endpoints)
  - `authorization-management`
  - `deployment-policy-read`
  - `deployment-policy-write`
  - `audit-ledger`
  - `node-trust`
  - `execution-node-management`
  - `security-certificate-operations`
  - `security-secret-metadata`
  - `storage-management`
  - `asset-management`
  - `image-asset-management`
  - `run-submission`
  - `run-read`
  - `run-mutation`
  - `image-run-api`
  - `run-execution-update`

## Current overreach called out
- Pre-login desktop startup still boots full authoritative server assembly.
- Startup currently composes full route-family coverage, broad persistence domains, and non-auth backends (workspace/admin, authorization, deployment, audit, node, storage, asset, runtime/run, certificate, secrets).
- Startup also composes execution adapter infrastructure not required for login.

## Required outputs from auth-minimal host to Electron main
- host `address` to build `identityApiBaseUrl`
- lifecycle stop handle
- startup success/failure signal
- optional startup diagnostics correlation id

## Boundary target
- Pre-login: identity-auth + trusted-device/session-context only.
- Post-login or on-demand: non-auth control-plane routes, services, persistence, and execution infrastructure.

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`
