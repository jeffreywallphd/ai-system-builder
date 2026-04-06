# AI Companion: Feature 1 Final Identity Baseline

## Purpose

Provide a concise implementation-truth handoff for downstream epics depending on local identity/account lifecycle.

## What is complete now

- Local account registration/login
- Password credential verification and change
- Session issuance/validation/logout/revoke
- Local identity admin list/get/status-set flows
- Provider abstraction and capability validation seam
- Lifecycle event publisher seam
- Redaction + response serializer hardening
- Environment-driven provider/account/session policy toggles

## Canonical runtime composition

- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Canonical downstream seams

Trusted device:

- request/session fields: `trustedDeviceBindingId`, `trustMarker`
- trust evaluation port: `application/identity/ports/IIdentitySessionTrustEvaluator.ts`

Workspace membership:

- principal seam: authenticated `userIdentityId` from `resolveAuthenticatedSession`

Authorization:

- admin action context contracts: `src/application/identity/use-cases/IdentityAdministrativeContext.ts`
- no in-slice role enforcement yet; downstream authorizer must be composed before admin use-case execution

## Must-do downstream dependencies

1. Implement trusted-device binding records + evaluator wiring.
2. Implement workspace membership model keyed by `userIdentityId`.
3. Implement role/permission authorizer for admin and future privileged identity actions.

## Policy/env controls to preserve

- provider/account toggles: `IdentityProviderAccountPolicyConfig`
- session policy toggles: `IdentitySessionPolicyConfig`
- keep `forbidden` behavior deterministic when registration/admin is policy-disabled

## Related docs

- `docs/architecture/identity-feature-1-final-baseline.md`
- `docs/architecture/identity-foundation.md`
- `docs/architecture/identity-server-api.md`
- `docs/architecture/identity-session-architecture.md`
