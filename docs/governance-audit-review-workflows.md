# Governance Audit Review Workflows

This document describes the admin-facing governance audit review surfaces introduced for Story 15.3.6.

For extending canonical audit emission and taxonomy rules (not just reviewing events), use:

- `docs/architecture/audit-taxonomy-capture-boundaries-and-extension-rules.md`
- `docs/audit-governance-contributor-guide.md`

## Entry points

- Settings -> **Governance review** (desktop)
- Settings -> **Governance review (thin)** (thin-client/admin-lite)
- Admin lite -> **Governance review (thin)**

Route: `src/ui/routes/RouteConfig.ts` -> `ROUTE_PATHS.governanceReview` (`/settings/governance-review`)  
Route: `src/ui/routes/RouteConfig.ts` -> `ROUTE_PATHS.governanceReviewThin` (`/settings/governance-review/thin`)

## Access posture

- Desktop governance review route requires:
  - desktop admin/operational surface
  - workspace role `owner` or `admin`
  - capability `log.read`
  - workspace context
- Thin governance review route requires:
  - thin-client/admin-lite surface
  - workspace role `owner`, `admin`, or `member`
  - capability `system.read`
  - workspace context
- Route access is enforced through metadata-driven strict gating in `AppRouter.tsx` (`SurfaceProtectedRoute`) to block direct URL/routing shortcuts for unauthorized sessions.

## Event coverage

The governance review surface aggregates prioritized governance and security events from existing services:

- login/session lifecycle events
- trusted-device revocation events
- node approval events
- permission/share mutation events
- storage metadata/policy/lifecycle governance events
- protected asset download access events
- secret access-decision and secret-operation governance events
- runtime run governance events

## Shared review behavior

- Shared review model and query normalization:
  - `src/ui/shared/admin/GovernanceAuditReviewModel.ts`
- Shared list/filter/detail presentation:
  - `src/ui/shared/admin/GovernanceAuditReviewPanels.tsx`
- Shared redaction utility:
  - `src/ui/shared/admin/GovernanceAuditRedaction.ts`
- Aggregation service:
  - `src/ui/services/GovernanceAuditReviewService.ts`

Filtering and pagination align to shared list query conventions (`workspaceId`, `search`, `limit`, `offset`, `sortBy`, `sortDirection`) with event/outcome filters layered on top.

## Redaction posture

- Sensitive and identifier-like values are redacted before display in list/detail surfaces.
- Detail payload rendering applies recursive redaction to nested fields.
- Long free-text values are trimmed for bounded display.

## Thin-client/admin-lite behavior

- Thin view uses compact event cards rather than the dense desktop table.
- Thin route forces `includeThinSafeOnly` filtering so only thin-appropriate governance event types are shown.

## Tests

- `src/ui/shared/admin/tests/GovernanceAuditRedaction.test.ts`
- `src/ui/services/tests/GovernanceAuditReviewService.test.ts`
- `src/ui/pages/tests/GovernanceAuditReviewPage.test.tsx`
- `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`
- `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
- `src/ui/routes/tests/RoutesContracts.test.ts`
- `src/ui/routes/tests/RoutesUnit.test.ts`
- `src/ui/routes/tests/RoutesInteractions.test.ts`
