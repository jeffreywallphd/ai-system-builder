# Authoritative Startup Persistence and Stage Auth-Necessity Inventory

Feature: B  
Epic: B.1  
Story: B.1.3

## Purpose

Inventory authoritative server startup stages and persistent services by desktop pre-login auth necessity so auth-minimal host refactoring can proceed without re-analysis.

This document extends Story B.1.1 (`auth-only-server-startup-contract`) and Story B.1.2 (`authoritative-route-family-pre-login-inventory`) from route-family scope to composition-stage and persistence-stage scope.

## Source of truth reviewed

- Prompt and doc guidance:
  - `docs/general-prompt-guidance.md`
  - `docs/architecture/auth-only-server-startup-contract.md`
  - `docs/architecture/authoritative-route-family-pre-login-inventory.md`
  - `docs/architecture/authoritative-server-host-assembly.md`
- Authoritative startup composition and contracts:
  - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
  - `src/hosts/server/AuthoritativeServerBootstrapStageContracts.ts`
  - `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
  - `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- Runtime host and transport composition:
  - `src/hosts/server/IdentityServerHost.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- Persistence composition:
  - `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- Deployment policy bootstrap:
  - `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`

## Classification legend

- `required-pre-login`: must remain in pre-login startup to satisfy desktop login/session bootstrap.
- `required-only-because-coupled`: technically required on the current path, but only due full-authoritative coupling; should be removed from auth-minimal startup.
- `defer-post-login-or-on-demand`: not needed for pre-login auth path.

## Stage inventory by auth necessity

| Startup area | Current authoritative responsibility | Classification | Why this classification | Auth-minimal target action |
| --- | --- | --- | --- | --- |
| `configuration` stage | Host options/runtime metadata deployment profile/tracer setup | `required-pre-login` | Needed to produce startup diagnostics and pass host bind/database/env config into startup flow. | Keep stage, but keep outputs narrow (host/address/runtime metadata/tracer only). |
| `services` stage: service registration plan | Compose host service registration plan and assert control-plane service coverage later | `required-only-because-coupled` | Coverage assertion is full-control-plane policy; desktop pre-login auth does not require broad control-plane dependency coverage. | Replace with auth-minimal dependency assertion (identity + trusted-device + session-context dependencies only). |
| `services` stage: route registration setup | Compose authoritative route registration plan | `required-pre-login` | Pre-login must expose identity routes and base URL reachability. | Keep, but generate plan with `identity-auth` only for auth mode. |
| `services` stage: execution adapter composition | Compose optional Comfy adapter infrastructure + run execution adapter registration | `defer-post-login-or-on-demand` | Run dispatch/cancellation/capability probing is unrelated to login/session bootstrap. | Remove from pre-login auth mode; compose when run features start. |
| `security` stage (contract-level) | Stage contract emits transport-trust/certificate/secrets readiness flags | `required-only-because-coupled` | Current stage implementation is placeholder booleans, while real heavy security setup is performed later in `startIdentityServerHost`; no auth-only boundary yet. | Split security into auth-minimal transport/session trust requirements vs full control-plane CA/secret/bootstrap requirements. |
| `persistence` stage: runtime start and migrations | Start SQLite persistence runtime with full authoritative migration hook set | `required-only-because-coupled` | Auth path needs persistence, but not full cross-domain migrations. Full migration set currently forced by shared composition. | Introduce auth-minimal migration hook set (identity + trusted-device + minimal workspace context projection data only). |
| `persistence` stage: persistent platform services | Compose full `AuthoritativePersistentPlatformServices` (identity/workspace/authorization/node/certs/secrets/storage/assets/platform/audit/deployment/generated-results) | `required-only-because-coupled` | Auth path needs only a small subset; full composition is current shared object-graph coupling. | Introduce auth-minimal persistent services surface; keep full surface for authoritative mode. |
| `persistence` stage: deployment policy bootstrap | Resolve deployment policy bootstrap and require artifact before feature registration | `required-only-because-coupled` | Deployment policy state is consumed by workspace creation/run/storage policy flows, not by login/session bootstrap. `IdentityServerHostOptions` already models this as optional. | Remove from pre-login auth mode startup contract; resolve post-login when policy-bound features initialize. |
| `transport` stage: route/service coverage assertions | Assert full required route families and full control-plane service coverage | `required-only-because-coupled` | Current required set is intentionally full authoritative scope, not pre-login auth scope. | Replace with auth-minimal assertions in auth mode (`identity-auth` coverage only). |
| `transport` stage: start host | Start HTTP host and provide address/port runtime handle | `required-pre-login` | Electron pre-login bootstrap needs reachable `identityApiBaseUrl`, startup success/failure, and stop lifecycle. | Keep, but start auth-minimal host composition (identity endpoints + trust/session context behavior only). |

## Persistence runtime responsibilities inventory

| Persistence runtime responsibility | Current state | Classification | Auth-minimal target |
| --- | --- | --- | --- |
| Open SQLite runtime and enforce migration ordering | Full authoritative migration hook set is always started in persistence stage | `required-pre-login` (narrowed) | Keep runtime open/start behavior. |
| Apply identity migrations | Included in authoritative migration set | `required-pre-login` | Keep. |
| Apply trusted-device migrations | Included in authoritative migration set | `required-pre-login` | Keep. |
| Apply workspace migrations | Included in authoritative migration set | `required-only-because-coupled` | Keep only if session-context endpoint continues to return workspace actor context from authoritative workspace repository; otherwise move to dedicated lightweight context projection store. |
| Apply authorization/node/execution/storage/assets/image/platform/audit/deployment/certificate/secret/generated-result migrations | Included today | `defer-post-login-or-on-demand` | Remove from auth-minimal startup path. |

## Persistent platform services inventory

From `AuthoritativePersistentPlatformServices` in `AuthoritativePersistenceComposition.ts`:

| Service/repository | Classification | Why | Auth-minimal target |
| --- | --- | --- | --- |
| `identityRepository` | `required-pre-login` | Required by register/login/session use cases. | Keep. |
| `trustedDeviceRepository` | `required-pre-login` | Required for trusted-device session trust evaluation and pairing metadata. | Keep. |
| `workspaceRepository` | `required-only-because-coupled` | `GET /api/v1/identity/session/context` currently calls `workspaceAdministrationBackendApi.listWorkspaces(...)`. | Keep temporarily or replace with a dedicated auth-context read port that does not require full workspace admin API composition. |
| `authorizationRepository` | `defer-post-login-or-on-demand` | Needed for authorization management and workspace/admin policy features, not login path. | Defer. |
| `nodeTrustRepository` + `nodeTrustAuditRecorder` | `defer-post-login-or-on-demand` | Node enrollment/trust operations are post-login control-plane scope. | Defer. |
| `executionNodeRepository` | `defer-post-login-or-on-demand` | Execution management/readiness is post-login runtime scope. | Defer. |
| `certificateAuthorityRepository` | `required-only-because-coupled` | Current host startup validates CA readiness globally before serving, but login/session APIs are not intrinsically CA-management APIs. | Remove as hard pre-login prerequisite except when explicit managed TLS policy requires it. |
| `secretRecordRepository` | `required-only-because-coupled` | Secret service is composed at startup and enforced globally; not a direct login/session endpoint dependency. | Defer or gate by explicit security policy requirement. |
| `storageInstanceRepository` + `storageManagementAuditRecorder` | `defer-post-login-or-on-demand` | Storage management is not pre-login auth critical. | Defer. |
| `assetRepository` + `assetAuditRecorder` + `assetUploadSessionRepository` | `defer-post-login-or-on-demand` | Asset lifecycle and upload flows are post-login features. | Defer. |
| `imageAssetRepository` | `defer-post-login-or-on-demand` | Image asset workflows are post-login features. | Defer. |
| `imageWorkflowSystemRepository` | `defer-post-login-or-on-demand` | Image run readiness and runtime integration are post-login execution features. | Defer. |
| `platformPersistenceRepository` | `defer-post-login-or-on-demand` | Run orchestration and platform audit persistence are post-login execution/control-plane concerns. | Defer. |
| `auditLedgerRepository` | `required-only-because-coupled` | Identity lifecycle publisher currently fans out to authoritative audit recorder; login can function without full audit-ledger startup gate. | Keep best-effort/non-blocking logging for auth mode or defer full audit-ledger recorder wiring. |
| `deploymentPolicyRepository` | `required-only-because-coupled` | Current composition resolves deployment bootstrap during persistence stage regardless of login needs. | Defer for auth mode. |
| `generatedResultRepository` | `defer-post-login-or-on-demand` | Generated-result read/preview is post-login runtime scope. | Defer. |

## Deployment policy bootstrap inventory

| Item | Current state | Classification | Target |
| --- | --- | --- | --- |
| `DeploymentPolicyBootstrapResolutionService.execute()` during persistence stage | Always resolved and required as startup artifact before transport registration | `required-only-because-coupled` | Remove from auth-minimal pre-login startup. Resolve when workspace creation/deployment policy/run/storage authorization flows are first needed. |

## Execution adapter composition inventory

| Item | Current state | Classification | Target |
| --- | --- | --- | --- |
| `createComfyUiExecutionAdapterInfrastructure(...)` | Composed in services/dependencies stage | `defer-post-login-or-on-demand` | Do not compose in auth-minimal pre-login startup. |
| `createAuthoritativeRunExecutionAdapterRegistration(...)` | Composed in services/dependencies stage and injected into host startup | `defer-post-login-or-on-demand` | Compose only when run orchestration features start. |

## Route registration setup inventory

| Item | Current state | Classification | Target |
| --- | --- | --- | --- |
| `AuthoritativeServerRequiredRouteFamilyIds` assertion | Requires identity + all non-auth control-plane route families | `required-only-because-coupled` | In auth mode, require only `identity-auth`. |
| Route-plan fallback in `createIdentityHttpServer(...)` | Can auto-compose route families from backend availability | `required-pre-login` | Keep; provide only identity backend (plus optional workspace context backend) for auth mode route composition. |

## Transport host startup inventory

| Item | Current state | Classification | Target |
| --- | --- | --- | --- |
| `startIdentityServerHost(...)` runtime startup | Composes identity plus broad non-auth backend APIs before server listen | `required-only-because-coupled` | Add auth-minimal host mode/startup path that composes only auth-critical backend graph. |
| HTTP server listen and address output | Emits `address`/`port` used by desktop bootstrap | `required-pre-login` | Keep unchanged contract. |
| Root readiness probe (`GET /`) + identity endpoint serving | Supports renderer connectivity and auth calls | `required-pre-login` | Keep. |

## Composition steps currently required only due coupling

These are the specific over-coupled steps that force non-auth infrastructure into pre-login startup today:

1. Full route-family assertion in `assertAuthoritativeServerApiRouteRegistrationCoverage(...)` with `AuthoritativeServerRequiredRouteFamilyIds`.
2. Full authoritative migration set from `createAuthoritativePersistenceMigrationHooks()` in pre-login path.
3. Full persistent-platform-service composition from `createAuthoritativePersistentPlatformServices(...)` before host start.
4. Mandatory deployment-policy bootstrap artifact resolution before transport stage.
5. Services-stage execution adapter composition and registration before login.
6. `startIdentityServerHost(...)` constructing non-auth backend APIs (workspace admin/invitations, authorization, deployment policy, audit, node trust, execution management, storage, assets, generated results, run orchestration) before binding transport.
7. Startup-gating CA/secret bootstrap and orchestration/audit reconciliation work prior to serving auth routes.

## Target responsibilities for auth-minimal composition root/host mode

Auth-minimal pre-login startup should own exactly these responsibilities:

1. Compose host config and lifecycle metadata/tracing.
2. Start a narrowed persistence runtime for auth-critical domains.
3. Compose auth-critical persistent services only:
   - identity repository,
   - trusted-device repository,
   - session-context workspace projection dependency (temporary: workspace repository; target: dedicated read port).
4. Compose identity auth backend and trusted-device/session-trust services.
5. Compose identity route registration plan requiring only `identity-auth`.
6. Start HTTP transport with:
   - identity auth endpoints (`login`, optional `dev-login`, optional `register`, `session`, `session/context`),
   - root readiness route for connectivity probe,
   - transport trust enforcement required by desktop trusted-session policy.
7. Return runtime handle contract used by Electron pre-login bootstrap:
   - `address`,
   - stop lifecycle,
   - startup success/failure,
   - optional `startupCorrelationId`.

Everything else remains authoritative full-mode startup and should be activated post-login or on first feature demand.

## Refactor-driving implementation checkpoints

To refactor without re-analysis, implement against this checklist:

1. Add an explicit auth-minimal startup mode selector at composition-root/entrypoint seam.
2. Add auth-minimal migration hook and persistent-service composition functions.
3. Add auth-minimal required route-family set (`identity-auth` only).
4. Make deployment-policy bootstrap artifact optional for auth-minimal transport stage.
5. Move execution adapter composition out of pre-login startup path.
6. Split `startIdentityServerHost(...)` into shared auth-core composition and deferred full-control-plane composition path.
7. Keep Electron pre-login contract unchanged (`identityApiBaseUrl` derivation from runtime `address`).

## Story B.2.3 implementation notes

Current auth-minimal persistence composition (`src/infrastructure/persistence/AuthMinimalPersistenceComposition.ts`) now narrows pre-login persistent composition to:

- identity repository,
- trusted-device repository,
- workspace repository (kept only for identity session-context workspace hydration),
- identity + workspace migration hooks.

The following repositories/services are intentionally excluded from auth-minimal pre-login composition:

- deployment policy administration persistence,
- storage management persistence,
- asset management and image-asset persistence,
- run orchestration and platform persistence,
- generated-result persistence,
- audit-ledger persistence,
- node-trust/execution-node persistence,
- certificate-authority and secret-record persistence.

Remaining shared runtime behavior in pre-login startup is limited to SQLite runtime startup and the narrowed auth-minimal migration hook set. Workspace persistence remains in auth-minimal mode only because `identity-auth` session-context responses depend on workspace context at login-time.
