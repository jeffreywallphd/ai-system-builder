# Authorization Sharing Management and Access Review

This guide documents the user/admin-facing sharing management, access review, and reporting surfaces delivered for Feature 4 / Epic 4.4.

## Audience

- Workspace owners and administrators managing access posture.
- Developers integrating new protected resources into sharing/reporting flows.

## What this surface covers

- Resource-level visibility and sharing policy updates.
- Explicit sharing grant creation and revocation.
- Effective-access inspection for current or inspected actors.
- Workspace-level reporting for role posture and unusual sharing patterns.

## Route and screen map

- Desktop sharing management: `/settings/sharing`
- Thin-client sharing management: `/settings/sharing/thin`
- Workspace authorization reporting: `/settings/sharing/reporting`

Desktop and thin-client routes support query-driven resource context:

- `resourceFamily`
- `resourceType`
- `resourceId`
- optional `workspaceId`

## Supported sharing model

### Visibility values

- `private`
- `workspace`
- `shared`
- `published`

### Sharing policy modes

- `owner-only`
- `workspace-members`
- `explicit`
- `published`

### Sharing targets

- person (`user`)
- workspace role (`workspace-role`)
- workspace (`workspace`)
- public (`public`)

## API operations

Resource management endpoints:

- `PATCH /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/visibility`
- `POST /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/sharing-grants`
- `DELETE /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/sharing-grants/:grantId`
- `GET /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/access-state`

Bulk/admin operations:

- `POST /api/v1/authorization/sharing-grants/workspace-role/bulk-upsert`
- `GET /api/v1/authorization/reporting/workspaces/:workspaceId`

Stable error contract:

- `invalid-request` (400)
- `authentication-failed` (401)
- `forbidden` (403)
- `not-found` (404)
- `conflict` (409)
- `internal` (500)

## Access review behavior

`access-state` responses include:

- inspector and inspected actor ids
- resource policy metadata snapshot
- sharing grants (optionally including revoked grants)
- per-permission decision rows with explanation channels:
  - ownership contribution
  - role-based contribution
  - direct permission-grant contribution
  - sharing-based contribution
  - visibility contribution

Inspection is policy-gated by resource-level authority (`<resource-family>.share` or `<resource-family>.manage`).

## Reporting behavior

Workspace reporting returns:

- role assignment snapshot
- visibility distribution totals
- unusual visibility/policy patterns
- recent sharing mutation history

Reporting is policy-gated by workspace capability authorization (`system.manage`).

Current unusual pattern flags:

- `private-resource-with-active-sharing-grants`
- `owner-only-policy-with-active-sharing-grants`
- `published-visibility-without-published-at`

## High-risk safeguard behavior

Server-side high-risk checks run during sharing/visibility mutations. When confirmation is required, callers must provide:

- `metadata.authorizationHighRiskConfirmation.confirmedRiskCodes`

Missing confirmation returns a conflict with reason code:

- `authorization-administration-high-risk-confirmation-required`

This safeguard is authoritative in backend use cases and does not rely on UI prompts.

## Adding new resource families to management surfaces

1. Extend permission catalog and role baselines.
2. Extend transport validation enums for resource family routing.
3. Add stable `resourceType` and `resourceId` tuple conventions.
4. Ensure management client/panel supports the new family.
5. Add reporting expectations if the resource is workspace-administered.
6. Add integration tests for API, HTTP mapping, and UI routes.

## Primary implementation references

- `infrastructure/api/authorization/AuthorizationManagementBackendApi.ts`
- `infrastructure/api/authorization/sdk/PublicAuthorizationManagementApiContract.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `ui/components/authorization/AuthorizationSharingManagementPanel.tsx`
- `ui/pages/AuthorizationSharingManagementPage.tsx`
- `ui/pages/AuthorizationSharingThinClientPage.tsx`
- `ui/pages/AuthorizationReportingPage.tsx`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthorizationManagement.test.ts`
- `infrastructure/api/authorization/tests/AuthorizationManagementBackendApi.test.ts`
