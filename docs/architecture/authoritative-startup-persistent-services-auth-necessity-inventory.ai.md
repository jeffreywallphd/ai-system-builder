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
