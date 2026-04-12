# AI Companion: Authorization Sharing Management and Access Review

## Purpose

Concise operations handoff for Feature 4 / Epic 4.4 sharing management, access inspection, and reporting surfaces.

## User/admin surfaces

- Desktop sharing: `/settings/sharing`
- Thin-client sharing: `/settings/sharing/thin`
- Reporting: `/settings/sharing/reporting`

## Core operations

- Visibility + sharing policy update
- Grant/revoke explicit sharing
- Access-state inspection (inspector + inspected actor)
- Workspace sharing/reporting read model query

## Policy gates

- Access-state read: `<resource-family>.share` or `<resource-family>.manage`
- Workspace reporting read: `system.manage` workspace capability

## Safeguard contract

- High-risk confirmation metadata path:
  - `metadata.authorizationHighRiskConfirmation.confirmedRiskCodes`
- Missing confirmation reason code:
  - `authorization-administration-high-risk-confirmation-required`

## Important extension notes

- Preserve stable resource tuple contracts (`resourceFamily`, `resourceType`, `resourceId`).
- Extend catalog/schema/UI/test coverage together when adding resource families or roles.
- Keep deny semantics and reporting auth gates centralized in backend APIs/use cases.

## Canonical references

- `src/infrastructure/api/authorization/AuthorizationManagementBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/ui/components/authorization/AuthorizationSharingManagementPanel.tsx`
- `src/ui/pages/AuthorizationReportingPage.tsx`
- `docs/architecture/authorization-feature-4-final-baseline.md`
