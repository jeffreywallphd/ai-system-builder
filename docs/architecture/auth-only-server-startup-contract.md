# Auth-Only Server Startup Contract

Feature: B  
Epic: B.1  
Story: B.1.1

## Purpose

Define the explicit server-side contract required before desktop login so later stories can implement an auth-only host mode without re-deciding scope.

This contract is derived from the current desktop auth bootstrap path in:

- `electron/main/main.ts`
- `electron/main/AuthBootstrapIpcRegistration.ts`
- `src/ui/App.tsx`
- `src/ui/services/IdentityAuthService.ts`
- `src/ui/shared/identity/IdentityAuthSessionCoordinator.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`

## Pre-login Contract: Required Server Responsibilities

### 1) Required identity/auth HTTP API surface

The pre-login desktop renderer auth/session path requires the identity auth route family (`/api/v1/identity/*`) with this minimum endpoint contract:

- `POST /api/v1/identity/login`
  - Required for local credential login from `LoginPage`.
  - Must accept desktop access-channel hints and trusted-device fields used by `DesktopTrustedDeviceIdentityAuthClient`.
- `POST /api/v1/identity/dev-login` (development only)
  - Required only when dev login is enabled.
- `POST /api/v1/identity/register` (if local registration remains available pre-login)
  - Required for `RegisterPage`.
- `GET /api/v1/identity/session`
  - Required for persisted session validation (`IdentityAuthSessionCoordinator`).
- `GET /api/v1/identity/session/context`
  - Required for session actor-context hydration (`IdentityAuthSessionCoordinator`), including workspace context and trusted-device/session trust metadata.

Notes:

- A reachable base URL is also required because desktop connectivity probing calls `fetch(identityApiBaseUrl)` during pre-login monitoring.
- This story defines the minimum for login/session bootstrap. Post-login management APIs (trusted-device management, identity admin, session admin) are not pre-login critical.

### 2) Required persistence responsibilities

The auth-minimal host must persist and resolve:

- identity account, credential, and session state for register/login/session validation.
- trusted-device and pairing state needed to evaluate trusted-session issuance and trust invalidation for desktop login.
- workspace actor-context read data required by `GET /api/v1/identity/session/context` (workspace list and role/capability projection for the authenticated actor).

Current code path evidence:

- `IdentityAuthBackendApi` is required for register/login/session resolution.
- `IdentityHttpServer` actor-context route currently calls `workspaceAdministrationBackendApi.listWorkspaces(...)`, so session-context hydration currently depends on workspace administration read composition even before login completes.

### 3) Required trust/bootstrap responsibilities

Pre-login auth-minimal server behavior must preserve desktop trust/session bootstrap guarantees:

- Enforce trusted-device session issuance when desktop login requests `sessionTrustRequirement: "require-trusted"`.
- Validate trusted-device binding material supplied by desktop login requests.
- Return session trust metadata consumed by renderer bootstrap (`assuranceLevel`, `trustState`, trust invalidation reasons, trusted device identifiers).
- Support actor-context response shape used to persist bootstrap session context in desktop storage.

## Explicitly Deferred From Pre-login Startup

The following route families are broader control-plane scope and should be deferred to post-login or on-demand startup:

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

These families are currently required by `AuthoritativeServerRequiredRouteFamilyIds` and therefore boot before login today, even though desktop login/session bootstrap only needs identity-auth responsibilities.

## Current Overreach to Remove

Current pre-login startup still launches full authoritative composition (`startAuthoritativeServerHostAssembly(...)`), which currently includes:

- full authoritative route-family coverage assertion in `AuthoritativeServerApiRouteComposition`.
- full authoritative persistence migration/composition via `createAuthoritativePersistenceMigrationHooks()` and `createAuthoritativePersistentPlatformServices(...)` across identity, workspace, authorization, node trust, certificates, secrets, storage, assets, image assets, generated results, audit, and deployment policy domains.
- full control-plane backend API assembly in `IdentityServerHost` (workspace, authorization, deployment, audit, node trust, execution, storage, asset, run mutation/read/submission/update, certificate, secret metadata).
- execution-adapter composition at authoritative startup (`composeRunExecutionAdapterRegistration` / Comfy adapter wiring).

This is broader than needed for desktop login and session bootstrap.

## Required Startup Outputs for Electron Main (Auth-Minimal Host)

Pre-login Electron startup (`bootstrapAuthShell()` in `electron/main/main.ts`) needs only this host runtime output contract:

- `address` (host:port) so main process can derive `identityApiBaseUrl` for renderer auth clients.
- lifecycle control to stop the auth host during desktop shutdown.
- startup success/failure signal (throw on failure).
- optional startup diagnostics (`startupCorrelationId`) for logging/telemetry continuity.

No pre-login requirement exists for full authoritative metadata, full control-plane readiness artifacts, or non-auth backend registrations.

## Auth-Minimal Boundary Target

An auth-minimal server startup mode should:

1. compose only identity-auth HTTP routes required above,
2. compose only persistence/services needed for identity, trusted-device trust evaluation, and session actor-context hydration,
3. defer non-auth control-plane routes/services/persistence until post-login or first feature use.

This note is the contract baseline for follow-on implementation stories in Epic B.1.

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`
