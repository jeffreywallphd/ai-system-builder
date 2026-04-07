# AI Companion: Governance Audit Review Workflows

## Scope

Story 15.3.6 admin-facing audit/governance review surfaces for prioritized security and operational events.

For canonical audit taxonomy/capture extension guidance, also reference:

- `docs/architecture/audit-taxonomy-capture-boundaries-and-extension-rules.md`
- `docs/architecture/audit-ledger-persistence-query-and-access-control-architecture.md`
- `docs/audit-governance-contributor-guide.md`

## Canonical files

- `src/ui/pages/GovernanceAuditReviewPage.tsx`
- `src/ui/services/GovernanceAuditReviewService.ts`
- `src/ui/shared/admin/GovernanceAuditReviewModel.ts`
- `src/ui/shared/admin/GovernanceAuditReviewPanels.tsx`
- `src/ui/shared/admin/GovernanceAuditRedaction.ts`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/pages/AdminLiteEntryPage.tsx`
- `src/infrastructure/api/audit/AuditLedgerBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuditLedger.test.ts`

## UX contract

- Desktop route: `/settings/governance-review`
- Thin/admin-lite route: `/settings/governance-review/thin`
- Desktop route is dense review-first (filter + table + detail)
- Thin route is compact and filtered to thin-safe event classes
- Event detail always displays redacted payload values
- Coverage includes identity/trust events, authorization mutation events, storage configuration events, protected asset access events, and secret governance events
- Authoritative retrieval seam for converged admin/governance consumers is `/api/v1/audit/events*` (list + detail).

## Access control contract

- `/settings/governance-review` requires:
  - surface: desktop admin/operational
  - roles: `owner` or `admin`
  - capability: `log.read`
  - workspace context
- `/settings/governance-review/thin` requires:
  - surface: thin-client/admin-lite
  - roles: `owner`, `admin`, or `member`
  - capability: `system.read`
  - workspace context
- Route blocking is metadata-driven through strict `SurfaceProtectedRoute` evaluation.

## Query/filter contract

- Canonical list query keys:
  - `workspaceId`, `search`, `limit`, `offset`, `sortBy`, `sortDirection`
- Governance-specific filters:
  - `eventTypes[]`
  - `outcomes[]`
  - `includeThinSafeOnly`
- Linkage selectors are also supported by the audit API contract (`correlationId`, `requestId`, `eventGroupId`, `rootEventId`, `parentEventId`, `workflowId`, `sessionRef`, `runId`, `governanceActionId`).
- Retention/lifecycle selectors are supported for policy-ready review paths (`retentionPosture`, `lifecycleState`, `retentionPolicyKey`, `retainUntilAfter`, `retainUntilBefore`).
- Query normalization enforces bounded pagination/search and supported sorting fields.

## Redaction contract

- Redacts sensitive keys and identifier/ref-like values.
- Applies recursive redaction to nested detail objects/arrays.
- Trims long string values for bounded display.

## Tests

- `src/ui/shared/admin/tests/GovernanceAuditRedaction.test.ts`
- `src/ui/services/tests/GovernanceAuditReviewService.test.ts`
- `src/ui/pages/tests/GovernanceAuditReviewPage.test.tsx`
- `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`
- `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
- `src/ui/routes/tests/RoutesContracts.test.ts`
- `src/ui/routes/tests/RoutesUnit.test.ts`
- `src/ui/routes/tests/RoutesInteractions.test.ts`
