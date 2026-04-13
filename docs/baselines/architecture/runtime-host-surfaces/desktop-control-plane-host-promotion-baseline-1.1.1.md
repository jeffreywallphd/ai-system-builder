---
title: Desktop Control-Plane Host Promotion Baseline (Story 1.1.1)
doc_type: baseline
status: active
authoritativeness: historical
owned_by: team:platform-architecture
last_reviewed: 2026-04-13
related_code_paths:
  - electron/main/main.ts
  - electron/main/runtime/PostLoginRuntimeBootstrapper.ts
  - src/hosts/server/AuthMinimalServerHostEntrypoint.ts
  - src/hosts/server/AuthoritativeServerHostEntrypoint.ts
  - src/hosts/server/AuthMinimalIdentityServerHost.ts
  - src/hosts/server/IdentityServerHost.ts
---

# Desktop Control-Plane Host Promotion Baseline (Story 1.1.1)

## Baseline Introduction

Snapshot date: 2026-04-13  
Snapshot scope: current desktop startup, auth-minimal bootstrap, authoritative promotion, and renderer transport continuity assumptions  
Why this baseline exists: establish repository-truth implementation evidence before Feature 1 persistent-host refactor work  
Current canonical guidance: `docs/architecture/domains/runtime-host-surfaces/overview.md` and `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`  
Historical handling note: baseline evidence for refactor planning; not itself a new runtime behavior contract

## Current Desktop Startup and Promotion Path (File-Level Precision)

### 1) Pre-login auth-shell startup in Electron main process

- `bootstrapAuthShell()` in `electron/main/main.ts` performs storage initialization and starts the pre-login host by calling `startAuthMinimalServerHostAssembly(...)`.
- The auth-minimal runtime handle is stored in `authMinimalServerRuntime`, and `identityApiBaseUrl` is derived from the returned host address.
- The auth bootstrap context exposed to renderer-facing IPC is built from that `identityApiBaseUrl`.

### 2) Auth-minimal host composition

- `startAuthMinimalServerHostAssembly(...)` in `src/hosts/server/AuthMinimalServerHostEntrypoint.ts` composes a narrowed host:
  - starts `startAuthMinimalIdentityServerHost(...)`,
  - uses `composeAuthMinimalServerApiRouteRegistrationPlan(...)`,
  - enforces auth-minimal route coverage,
  - disables execution infrastructure with `executionInfrastructureEnabled: false`.
- `startAuthMinimalIdentityServerHost(...)` in `src/hosts/server/AuthMinimalIdentityServerHost.ts` binds the HTTP listener via `server.listen(...)` and disposes it via `server.close(...)`.

### 3) Post-login warmup entry and host promotion trigger

- `ensurePostLoginWarmupStarted(...)` in `electron/main/main.ts` is the promotion entrypoint and calls `promoteControlPlaneRuntimeForPostLogin(authShell)` before starting deferred post-login runtime bootstrap.
- After promotion, post-login warmup uses `postLoginRuntimeBootstrapper.bootstrap(runtimeAuthShell)` and starts connectivity monitoring against the promoted `identityApiBaseUrl`.
- Post-login runtime capability activation occurs in `electron/main/runtime/PostLoginRuntimeBootstrapper.ts` (service supervisor, deferred feature IPC registration, and status transitions) and is decoupled from initial pre-login bootstrap.

### 4) Authoritative host composition after promotion

- `promoteControlPlaneRuntimeForPostLogin(...)` calls `startAuthoritativeServerHostAssembly(...)` from `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`.
- `startAuthoritativeServerHostAssembly(...)` composes through `constructAuthoritativeServerHostAssembly(...)` and `createAuthoritativeServerCompositionRoot(...)`.
- The authoritative composition root uses `startIdentityServerHost(...)`, which binds transport through `server.listen(...)` and stops through `server.close(...)` in `src/hosts/server/IdentityServerHost.ts`.

## Exact Server Replacement Path That Introduces Transport Outage Risk

Current promotion sequence in `promoteControlPlaneRuntimeForPostLogin(...)`:

1. Read existing auth-minimal runtime handle and capture `previousRuntime.port`.
2. `await previousRuntime.stop();`
3. Set `authMinimalServerRuntime = undefined`.
4. Start authoritative host on the captured port with `startAuthoritativeServerHostAssembly(...)`.
5. Assign `authMinimalServerRuntime = upgradedRuntime` and rebuild `identityApiBaseUrl`.

This is a stop-then-start replacement sequence on the renderer-facing local control-plane socket. During the interval between steps 2 and 4, no process is bound to the port, so in-flight or concurrent renderer calls can receive connection-refused errors.

## Current Renderer-Facing Transport Assumptions

- Renderer auth/bootstrap logic assumes one reachable local `identityApiBaseUrl` carried through bootstrap context.
- The current implementation preserves port identity across promotion, but not listener continuity.
- Existing boundary guardrail (`electron/main/tests/MainDeferredRuntimeStartupBoundary.test.ts`) asserts ordering (`stop` before authoritative `start`) to avoid SQLite contention, which also confirms the current replacement behavior.

## Required Invariants For Persistent-Host Refactor (Feature 1 / Epic 1.1)

The new design must preserve these invariants:

1. Bind-once listener: renderer-facing control-plane socket binds once and remains available for the full desktop session.
2. No socket outage during auth transition: post-login capability activation must not require stop/start replacement of the renderer-facing HTTP listener.
3. Stable transport identity: renderer-visible base URL/endpoint remains stable across pre-login, login, and post-login warmup phases.
4. Capability lifecycle over transport lifecycle: capability activation/deactivation is expressed through explicit runtime lifecycle/state contracts (for example readiness/status signals), not socket availability.
5. Disposal boundary stays session-scoped: listener teardown occurs only during desktop host shutdown/disposal, not during login-state promotion.

## Story 1.1.1 Scope Outcome

- Baseline documentation added with concrete code-path evidence for startup and promotion.
- Exact replacement path causing connection-refusal windows identified.
- Target persistent-host invariants captured for follow-on stories.
- No production runtime behavior changed.
