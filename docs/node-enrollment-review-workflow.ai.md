# AI Companion: Node Enrollment Review Workflow

## Scope

UI-facing admin review and decision flow for pending node enrollment requests (Story 5.2.5).

## Canonical files

- `src/ui/pages/NodeEnrollmentReviewPage.tsx`
- `src/ui/services/NodeEnrollmentReviewService.ts`
- `src/ui/shared/nodes/NodeEnrollmentReviewClient.ts`
- `src/ui/shared/nodes/NodeTrustAdministrationPanels.tsx`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/pages/SettingsPage.tsx`
- `src/ui/styles/app.css`

## UX contract

- Entry route: `/settings/node-enrollments`
- Settings link label: `Node enrollment review`
- Session-gated access: unauthenticated/expired users receive sign-in guidance
- Admin surface actions:
  - load pending requests
  - inspect one request detail
  - approve with optional decision note
  - reject with optional decision note
- Surface-specific rendering:
  - desktop: dense table + row action menus
  - thin/admin-lite: compact cards + action lists
  - both reuse one shared decision panel action contract

## Data contract posture

- Uses shared node-trust transport DTOs and real backend routes:
  - `GET /api/v1/nodes/enrollments/pending`
  - `GET /api/v1/nodes/enrollments/:requestId`
  - `POST /api/v1/nodes/enrollments/:requestId/approve`
  - `POST /api/v1/nodes/enrollments/:requestId/reject`
- No mock data or placeholder workflow.
- List/detail state refreshes after decision mutations so UI stays backend-authoritative.

## Edge handling

- explicit loading and empty states
- explicit mutation success messaging
- explicit error alerts for transport/api failures

## Tests in this slice

- `src/ui/shared/nodes/tests/NodeEnrollmentReviewClient.test.ts`
- `src/ui/pages/tests/NodeEnrollmentReviewPage.test.tsx`
- `src/ui/shared/nodes/tests/NodeTrustAdministrationPanels.test.tsx`
- route/settings/service contract assertions updated to include new node-enrollment review entry points
