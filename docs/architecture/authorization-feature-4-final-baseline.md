# Feature 4 Final Baseline: Authorization, Visibility, and Sharing Policy Engine

This document is the production implementation baseline for Feature 4. It summarizes the current authorization subsystem across Epics 4.1-4.4 and provides extension rules for future protected resources and roles.

## Baseline status

Feature 4 is implemented end-to-end across domain contracts, policy evaluation, persistence, enforcement adapters, sharing management, access review, and workspace-level reporting.

Implemented capability areas:

- workspace-aware RBAC role assignments and permission catalog resolution
- resource visibility and explicit sharing policy metadata
- deterministic policy decision evaluation for `resource-instance` and `workspace-capability` targets
- centralized application use cases for role, sharing, and visibility administration
- shared transport enforcement adapters for HTTP/WebSocket/IPC
- protected read/list filtering and partial-response redaction seams
- desktop and thin-client sharing management/access review UI flows
- workspace-scoped reporting for authorization and sharing governance
- high-risk mutation safeguards and continuity protection for workspace administrators

## Canonical implementation map

### Domain and contracts

- `src/domain/authorization/AuthorizationDomain.ts`
- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/domain/authorization/AuthorizationRoleDefinitions.ts`
- `src/shared/contracts/authorization/AuthorizationPolicyContracts.ts`
- `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts`

### Application policy and administration

- `src/application/authorization/use-cases/EffectivePermissionResolutionService.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
- `src/application/authorization/use-cases/AuthorizationPolicyMutationService.ts`
- `src/application/authorization/use-cases/AssignAuthorizationRoleUseCase.ts`
- `src/application/authorization/use-cases/RemoveAuthorizationRoleUseCase.ts`
- `src/application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase.ts`
- `src/application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase.ts`
- `src/application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase.ts`
- `src/application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase.ts`
- `src/application/authorization/use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase.ts`
- `src/application/authorization/use-cases/AuthorizationHighRiskChangeSafeguards.ts`
- `src/application/authorization/use-cases/AuthorizationResponseRedaction.ts`

### Persistence and transport/runtime integration

- `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
- `src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter.ts`
- `infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
- `infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
- `infrastructure/api/authorization/AuthorizationManagementBackendApi.ts`
- `infrastructure/api/authorization/sdk/PublicAuthorizationManagementApiContract.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

### Desktop and thin-client management surfaces

- `ui/components/authorization/AuthorizationSharingManagementPanel.tsx`
- `ui/pages/AuthorizationSharingManagementPage.tsx`
- `ui/pages/AuthorizationSharingThinClientPage.tsx`
- `ui/pages/AuthorizationReportingPage.tsx`
- `ui/shared/authorization/AuthorizationManagementClient.ts`
- `ui/services/AuthorizationManagementService.ts`
- `ui/web/authorization/AuthorizationSharingRoutes.ts`

## Authoritative policy model

Feature 4 policy decisions resolve against a single precedence model:

1. explicit deny permission grants
2. owner override
3. role baseline grants
4. explicit allow permission grants
5. explicit sharing grants
6. visibility fallback (`workspace` and `published` read/list semantics)
7. default deny

Supported visibility modes:

- `private`
- `workspace`
- `shared`
- `published`

Supported sharing policy modes:

- `owner-only`
- `workspace-members`
- `explicit`
- `published`

Supported explicit sharing targets:

- `user`
- `workspace-role`
- `workspace`
- `public`

## Management and inspection API surfaces

Identity HTTP server exposes authorization management endpoints:

- `PATCH /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/visibility`
- `POST /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/sharing-grants`
- `DELETE /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/sharing-grants/:grantId`
- `GET /api/v1/authorization/resources/:resourceFamily/:resourceType/:resourceId/access-state`
- `POST /api/v1/authorization/sharing-grants/workspace-role/bulk-upsert`
- `GET /api/v1/authorization/reporting/workspaces/:workspaceId`

Stable authorization management error mapping:

- `invalid-request` -> 400
- `authentication-failed` -> 401
- `forbidden` -> 403
- `not-found` -> 404
- `conflict` -> 409
- `internal` -> 500

## UI management flows

Resource sharing and visibility screens:

- desktop full flow: `/settings/sharing`
- thin-client compact flow: `/settings/sharing/thin`
- workspace reporting flow: `/settings/sharing/reporting`

Shared panel capabilities:

- load access state for current or inspected actor
- edit visibility and sharing policy metadata
- grant and revoke explicit sharing access
- inspect per-permission contribution explanations
- optionally include denied permissions and revoked grants during review

## Safeguards and governance

High-risk mutations are server-enforced (not UI-only) and require explicit confirmation metadata when applicable:

- metadata path: `metadata.authorizationHighRiskConfirmation.confirmedRiskCodes`
- conflict reason code when missing: `authorization-administration-high-risk-confirmation-required`

High-risk detection includes:

- visibility broadening and publication transitions
- enabling resharing
- broad-subject sharing grants
- elevated permission sharing actions
- last workspace-administrator removal protection

## Extension checklist for new resources and roles

When adding a new protected resource family:

1. Extend `AuthorizationPermissionCatalog` actions/keys.
2. Update role baselines in `AuthorizationRoleDefinitions` as needed.
3. Persist resource policy metadata and stable resource tuple (`resourceFamily`, `resourceType`, `resourceId`).
4. Reuse `AuthorizationPolicyDecisionEvaluator` or `AuthorizationTransportPolicyGuard`; do not add route-local role logic.
5. Add list filtering and redaction handling where partial access is valid.
6. Add API/UI coverage in management and reporting flows if the resource is user-administered.
7. Add tests for allow, deny, malformed context, and leakage-resistant behavior.

When adding a new role:

1. Add role key/type validation in `AuthorizationRoleDefinitions`.
2. Define baseline permission set and override behavior.
3. Update transport schema enums and UI role selectors for sharing targets.
4. Update reporting/read-model expectations and tests.

## Verification baseline

Core test suites validating Feature 4 contracts and integration:

- `src/domain/authorization/tests/AuthorizationDomain.test.ts`
- `src/domain/authorization/tests/AuthorizationPermissionCatalog.test.ts`
- `src/domain/authorization/tests/AuthorizationRoleDefinitions.test.ts`
- `src/application/authorization/tests/EffectivePermissionResolutionService.test.ts`
- `src/application/authorization/tests/AuthorizationPolicyDecisionEvaluator.test.ts`
- `src/application/authorization/tests/AuthorizationAdministrationUseCases.test.ts`
- `infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
- `infrastructure/api/authorization/tests/AuthorizationManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthorizationManagement.test.ts`
- `ui/shared/authorization/tests/AuthorizationManagementClient.test.ts`
- `ui/web/authorization/tests/AuthorizationSharingRoutes.test.ts`
- `ui/pages/tests/AuthorizationSharingManagementPage.test.tsx`
- `ui/pages/tests/AuthorizationSharingThinClientPage.test.tsx`
- `ui/pages/tests/AuthorizationReportingPage.test.tsx`

## Related docs

- `docs/architecture/authorization-feature-4-epic-4.1-baseline.md`
- `docs/architecture/authorization-feature-4-epic-4.2-policy-evaluation-engine-and-authorization-persistence.md`
- `docs/architecture/authorization-feature-4-epic-4.3-protected-resource-enforcement-and-runtime-integration.md`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/authorization-sharing-management-and-access-review.md`
