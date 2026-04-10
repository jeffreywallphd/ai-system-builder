# AI Companion: Authoritative Route Family Pre-Login Inventory

Feature: B  
Epic: B.1  
Story: B.1.2

Primary reference: `docs/architecture/authoritative-route-family-pre-login-inventory.md`

## Goal

Pin down which authoritative route families are truly needed before desktop login and which families should be deferred from pre-login startup.

## Core outcome

- Pre-login minimal route-family requirement: `identity-auth` only.
- Every currently startup-required family in `AuthoritativeServerRequiredRouteFamilyIds` is classified.
- Non-auth control-plane families are classified as `optional/on-demand` for post-login or feature-triggered startup.
- `system-runtime` is explicitly called out as `not relevant to the desktop pre-login path` (not currently required by startup coverage assertion).

## Evidence baseline used

- Route registration catalog and startup required-family assertion:
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
  - `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- Renderer and pre-login host behavior:
  - `src/ui/pages/LoginPage.tsx`
  - `src/ui/pages/RegisterPage.tsx`
  - `src/ui/services/IdentityAuthService.ts`
  - `src/ui/shared/identity/IdentityAuthSessionCoordinator.ts`
  - `src/ui/App.tsx`
  - `electron/main/main.ts` (`bootstrapAuthShell()`)
  - `electron/main/DesktopTrustBootstrap.ts`
- Identity session-context implementation detail:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Classification summary

- `required before login`
  - `identity-auth`
- `required only after login`
  - none currently proven as immediate/auth-shell mandatory
- `optional/on-demand`
  - `workspace-invitations`
  - `workspace-administration`
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
- `not relevant to desktop pre-login path`
  - `system-runtime`

## Refactor direction

- Auth-minimal pre-login route registration assertion should require only `identity-auth`.
- Keep workspace actor-context hydration as an identity-backend dependency for `/api/v1/identity/session/context`, without forcing pre-login workspace route-family registration.
