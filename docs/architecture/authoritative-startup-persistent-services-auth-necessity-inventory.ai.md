# AI Companion: Authoritative Startup Persistent Services Auth-Necessity Inventory

Feature: B  
Epic: B.1  
Story: B.1.3

Primary reference: `docs/architecture/authoritative-startup-persistent-services-auth-necessity-inventory.md`

## Goal

Classify authoritative startup stages, persistence responsibilities, and persistent services by desktop pre-login auth necessity so auth-minimal host refactoring can proceed directly.

## Core outcome

- Explicit startup-stage inventory now classifies:
  - persistence runtime responsibilities,
  - persistent platform services,
  - deployment policy bootstrap,
  - execution adapter composition,
  - route registration setup,
  - transport host startup.
- Auth-minimal pre-login required responsibilities are narrowed to identity/trusted-device/session-context and transport readiness.
- Coupling-driven overreach is explicitly identified as current technical requirements that should be removed from pre-login startup.
- A concrete refactor checklist is included for composition-root and host-mode narrowing.

## Key classifications

- `required-pre-login`:
  - host config/lifecycle metadata setup,
  - auth-critical persistence runtime startup,
  - identity + trusted-device persistence/services,
  - identity route registration (`identity-auth`),
  - transport host listen/address lifecycle.
- `required-only-because-coupled` (current overreach):
  - full service coverage assertions,
  - full authoritative migration/service composition,
  - deployment policy bootstrap at pre-login startup,
  - CA/secret/bootstrap and audit/recovery startup gates,
  - workspace-admin dependency for identity session-context hydration.
- `defer-post-login-or-on-demand`:
  - execution adapter composition,
  - non-auth persistence domains and repositories,
  - non-auth route families and backend API composition.

## Refactor target

Auth-minimal startup mode should start only identity-auth transport and auth-critical persistence/service composition, while deferring deployment policy, execution adapters, non-auth route families, and broader authoritative control-plane composition to post-login or first feature use.

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

## Story B.2.4 implementation notes

Auth-minimal pre-login startup now enforces execution-infrastructure exclusion at shared startup composition:

- `AuthoritativeServerCompositionRoot` bootstrap supports `executionInfrastructureEnabled`.
- `AuthMinimalServerHostEntrypoint` sets `executionInfrastructureEnabled: false`.
- When disabled, pre-login startup skips:
  - ComfyUI adapter infrastructure composition,
  - run-execution adapter registration composition,
  - related startup artifacts and host `runExecutionAdapters` injection.

Full authoritative startup still composes execution infrastructure normally when enabled by environment/configuration.
