# Node Enrollment Review Workflow

This operational note documents Story 5.2.5 (Feature 5 / Epic 5.2): the first production admin UI flow for reviewing pending node enrollment requests and taking approve/reject actions.

## Purpose

- Provide an explicit admin review path for pending compute/hybrid node enrollment requests.
- Use real node-trust APIs and shared contracts without mock data or placeholder workflows.
- Keep enrollment state and trust decisions observable from one consistent settings entry point.

## Canonical implementation

- `src/ui/pages/NodeEnrollmentReviewPage.tsx`
- `src/ui/services/NodeEnrollmentReviewService.ts`
- `src/ui/shared/nodes/NodeEnrollmentReviewClient.ts`
- `src/ui/shared/nodes/NodeTrustAdministrationPanels.tsx`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/pages/SettingsPage.tsx`
- `src/ui/styles/app.css`

## Admin workflow

Entry route:

- `/settings/node-enrollments`

Primary flow:

- list pending enrollment requests via `GET /api/v1/nodes/enrollments/pending`
- select one enrollment and load detail via `GET /api/v1/nodes/enrollments/:requestId`
- approve request via `POST /api/v1/nodes/enrollments/:requestId/approve`
- reject request via `POST /api/v1/nodes/enrollments/:requestId/reject`

Displayed request fields:

- display name
- node type
- capability profile summary
- deployment tags
- request timestamp
- trust lifecycle status (pending enrollment context)
- node heartbeat and capability context in linked inventory detail workflows

Surface behavior:

- desktop sessions render dense tabular pending-request review with row action menus
- thin-client/admin-lite sessions render compact card review with shared action lists
- both surfaces use one shared review decision action contract (approve/reject with optional decision note)

## State handling

The UI explicitly handles:

- loading: pending list and detail fetches
- empty state: no pending enrollment requests
- mutation success: approval/rejection status feedback
- errors: API-level failures surfaced as alert messages

Backend state remains authoritative; after each decision, the UI refreshes pending requests from the server.

## Security and authorization posture

- routes require an authenticated identity session
- enrollment review actions are server-authorized through existing node-trust application hooks
- actor identity and request identity for decision routes are bound by server transport handlers, not client-supplied IDs

## Tests

- `src/ui/shared/nodes/tests/NodeEnrollmentReviewClient.test.ts`
- `src/ui/pages/tests/NodeEnrollmentReviewPage.test.tsx`
- `src/ui/shared/nodes/tests/NodeTrustAdministrationPanels.test.tsx`
- route/settings contract updates in:
  - `src/ui/routes/tests/RoutesContracts.test.ts`
  - `src/ui/routes/tests/RoutesUnit.test.ts`
  - `src/ui/pages/tests/SettingsPage.test.ts`
  - `src/ui/pages/tests/PagesContracts.test.ts`
  - `src/ui/services/tests/ServicesContracts.test.ts`
