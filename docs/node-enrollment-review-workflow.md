# Node Enrollment Review Workflow

This operational note documents Story 5.2.5 (Feature 5 / Epic 5.2): the first production admin UI flow for reviewing pending node enrollment requests and taking approve/reject actions.

## Purpose

- Provide an explicit admin review path for pending compute/hybrid node enrollment requests.
- Use real node-trust APIs and shared contracts without mock data or placeholder workflows.
- Keep enrollment state and trust decisions observable from one consistent settings entry point.

## Canonical implementation

- `ui/pages/NodeEnrollmentReviewPage.tsx`
- `ui/services/NodeEnrollmentReviewService.ts`
- `ui/shared/nodes/NodeEnrollmentReviewClient.ts`
- `ui/routes/RouteConfig.ts`
- `ui/routes/AppRouter.tsx`
- `ui/pages/SettingsPage.tsx`
- `ui/styles/app.css`

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

- `ui/shared/nodes/tests/NodeEnrollmentReviewClient.test.ts`
- `ui/pages/tests/NodeEnrollmentReviewPage.test.tsx`
- route/settings contract updates in:
  - `ui/routes/tests/RoutesContracts.test.ts`
  - `ui/routes/tests/RoutesUnit.test.ts`
  - `ui/pages/tests/SettingsPage.test.ts`
  - `ui/pages/tests/PagesContracts.test.ts`
  - `ui/services/tests/ServicesContracts.test.ts`
