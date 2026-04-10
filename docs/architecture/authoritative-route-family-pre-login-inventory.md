# Authoritative Route Family Pre-Login Inventory

Feature: B  
Epic: B.1  
Story: B.1.2

## Purpose

Classify authoritative route families by desktop pre-login necessity using concrete renderer and Electron main startup behavior, so route-plan refactoring can narrow pre-login startup to auth-minimal scope.

## Source of truth reviewed

- Prompt guidance: `docs/general-prompt-guidance.md`
- Story B.1.1 contract: `docs/architecture/auth-only-server-startup-contract.md`
- Authoritative route registration catalog: `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- Current startup-required route families: `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- Renderer auth/session bootstrap usage:
  - `src/ui/pages/LoginPage.tsx`
  - `src/ui/pages/RegisterPage.tsx`
  - `src/ui/services/IdentityAuthService.ts`
  - `src/ui/shared/identity/IdentityAuthSessionCoordinator.ts`
  - `src/ui/App.tsx`
- Desktop pre-login host startup:
  - `electron/main/main.ts` (`bootstrapAuthShell()`)
  - `electron/main/DesktopTrustBootstrap.ts`
- Identity route implementation detail:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Route-family to shared client mappings:
  - `docs/architecture/unified-api-endpoint-reference.md`

## Classification legend

- `required before login`: must be available on the first login-capable renderer path.
- `required only after login`: not needed for login/bootstrap, but required immediately once authenticated shell starts.
- `optional/on-demand`: used by specific authenticated (or deep-link) surfaces; should not gate pre-login startup.
- `not relevant to the desktop pre-login path`: not part of desktop auth bootstrap requirements.

## Auth/session bootstrap evidence baseline

Desktop pre-login behavior currently uses only identity endpoints and base URL reachability:

- login and dev-login from `LoginPage` via `IdentityAuthService`.
- account registration from `RegisterPage` via `IdentityAuthService`.
- persisted session validation and context hydration in `IdentityAuthSessionCoordinator`:
  - `resolveAuthenticatedSession(...)` (`GET /api/v1/identity/session`)
  - `resolveSessionActorContext(...)` (`GET /api/v1/identity/session/context`)
- pre-login host boot in `bootstrapAuthShell()` starts authoritative host and exposes `identityApiBaseUrl`.
- pre-login connectivity probing calls `fetch(identityApiBaseUrl)` in `probeTransportReachability(...)`.

Important implementation note: `GET /api/v1/identity/session/context` currently reads workspace data through `workspaceAdministrationBackendApi.listWorkspaces(...)` inside `IdentityHttpServer`, but that does not require exposing the `workspace-administration` route family itself.

## Route-family inventory and classification

| Route family id | In current startup required list (`AuthoritativeServerRequiredRouteFamilyIds`) | Classification | Evidence and rationale |
| --- | --- | --- | --- |
| `identity-auth` | yes | required before login | Login/register/session bootstrap calls are all identity routes (`LoginPage`, `RegisterPage`, `IdentityAuthSessionCoordinator`, `IdentityAuthService`). B.1.1 contract defines this as the required pre-login family. |
| `workspace-invitations` | yes | optional/on-demand | Used by workspace invitation flows (`AppRouter` includes `workspaceInvitationAccept` route), not required for baseline sign-in/session restore. |
| `workspace-administration` | yes | optional/on-demand | Renderer workspace admin pages are authenticated/protected. Pre-login bootstrap needs workspace context data through identity session-context processing, not workspace route registration. |
| `authorization-management` | yes | optional/on-demand | Routed to authenticated authorization pages (`AppRouter` protected routes). Not used by pre-login auth/session bootstrap path. |
| `deployment-policy-read` | yes | optional/on-demand | Deployment policy admin surfaces are authenticated and route-protected. Not used by login/register/session bootstrap. |
| `deployment-policy-write` | yes | optional/on-demand | Same as read family: control-plane mutation surface, not pre-login auth critical path. |
| `audit-ledger` | yes | optional/on-demand | Governance/audit review UI is authenticated and route-protected; unrelated to first login-capable renderer requirements. |
| `node-trust` | yes | optional/on-demand | Node enrollment/review/inventory surfaces are feature/admin routes, not auth bootstrap. |
| `execution-node-management` | yes | optional/on-demand | Execution readiness/management is a post-auth operational feature; not part of login/session restore. |
| `security-certificate-operations` | yes | optional/on-demand | Certificate admin operations are security control-plane concerns after authentication. |
| `security-secret-metadata` | yes | optional/on-demand | Secret metadata administration surfaces are authenticated/admin, not pre-login auth bootstrap. |
| `storage-management` | yes | optional/on-demand | Storage administration is an authenticated control-plane feature; not required before login. |
| `asset-management` | yes | optional/on-demand | Asset workflow surfaces are authenticated feature routes, not login/session bootstrap dependencies. |
| `image-asset-management` | yes | optional/on-demand | Image asset ingestion/read APIs support feature workflows after auth, not pre-login identity bootstrap. |
| `run-submission` | yes | optional/on-demand | Run submission is feature runtime behavior after auth (run pages/studio), not login path. |
| `run-read` | yes | optional/on-demand | Run history/status read is feature runtime behavior after auth, not login path. |
| `run-mutation` | yes | optional/on-demand | Run cancel/control mutations are feature runtime behavior after auth, not login path. |
| `image-run-api` | yes | optional/on-demand | Image-run aliases are feature/studio oriented, not needed for login/session bootstrap. |
| `run-execution-update` | yes | optional/on-demand | Execution update ingestion is orchestration control-plane behavior, unrelated to pre-login auth. |
| `system-runtime` | no | not relevant to the desktop pre-login path | Not currently required by startup coverage assertion. Catalog family exists, but `composeAuthoritativeServerApiRouteRegistrationPlan()` sets system runtime backend availability false and pre-login auth shell does not rely on this family. |

## Minimal pre-login set and defer list

### Minimal pre-login route-family set

- `identity-auth` only.

### Families to move out of pre-login startup

All currently required families except `identity-auth` should be removed from the pre-login required coverage assertion and loaded post-login or on-demand:

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

## Route-plan refactor target (aligned with Story B.1.1)

Pre-login auth-minimal route registration target:

1. required pre-login coverage assertion includes only `identity-auth`;
2. auth-minimal host composes only identity auth endpoints required for login/session bootstrap and transport reachability;
3. non-auth control-plane route families are registered after authentication or on first feature use;
4. workspace actor-context data dependency for `GET /api/v1/identity/session/context` remains fulfilled as an identity-backend responsibility, without forcing `workspace-administration` route family registration pre-login.

This inventory is the implementation map for narrowing `AuthoritativeServerRequiredRouteFamilyIds` in the auth-minimal startup path.
