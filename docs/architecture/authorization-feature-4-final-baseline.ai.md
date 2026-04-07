# AI Companion: Feature 4 Final Authorization Baseline

## Purpose

Provide a durable implementation-truth handoff for the production authorization, visibility, and sharing subsystem.

## Feature scope completed

- Workspace-aware RBAC foundations with canonical role and permission catalogs.
- Visibility and explicit-sharing domain contracts with invariant validation.
- Deterministic policy evaluation for resource-instance and workspace-capability targets.
- Centralized authorization administration use cases for role/share/visibility mutation and access inspection.
- HTTP/WebSocket/IPC enforcement seams and runtime integration.
- Sharing management + access review + reporting API and UI surfaces.
- High-risk mutation safeguards and administrative continuity guardrails.

## Canonical seams

- Domain/contracts: `src/domain/authorization/*`, `src/shared/contracts/authorization/*`, `src/shared/schemas/authorization/*`
- Application: `src/application/authorization/use-cases/*`
- Persistence: `src/infrastructure/persistence/authorization/*`
- Transport/API: `src/infrastructure/transport/authorization/*`, `src/infrastructure/api/authorization/*`, `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- UI: `src/ui/components/authorization/*`, `src/ui/pages/AuthorizationSharingManagementPage.tsx`, `src/ui/pages/AuthorizationSharingThinClientPage.tsx`, `src/ui/pages/AuthorizationReportingPage.tsx`

## Operationally important contracts

- Management endpoints:
  - `PATCH .../visibility`
  - `POST .../sharing-grants`
  - `DELETE .../sharing-grants/:grantId`
  - `GET .../access-state`
  - `POST /api/v1/authorization/sharing-grants/workspace-role/bulk-upsert`
  - `GET /api/v1/authorization/reporting/workspaces/:workspaceId`
- UI routes:
  - `/settings/sharing`
  - `/settings/sharing/thin`
  - `/settings/sharing/reporting`
- Safeguard confirmation metadata:
  - `metadata.authorizationHighRiskConfirmation.confirmedRiskCodes`

## Extension rules to preserve

1. Keep precedence and decision composition centralized; do not duplicate policy logic in handlers/pages.
2. Keep protected-resource tuple contracts stable (`resourceFamily`, `resourceType`, `resourceId`).
3. Extend resource families/roles through catalog + schema + UI + tests together.
4. Preserve non-leaky deny behavior and partial-access redaction patterns.
5. Keep workspace reporting policy-gated (`system.manage` capability checks).

## Primary references

- `docs/architecture/authorization-feature-4-final-baseline.md`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/authorization-sharing-management-and-access-review.md`
