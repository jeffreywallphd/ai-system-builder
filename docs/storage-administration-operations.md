# Storage Administration Screens

This note documents Story 9.4.1, Story 9.4.2, Story 9.4.3, Story 9.4.4, and Story 9.4.5 (Feature 9 / Epic 9.4): storage administration list/detail, create/edit workflows, operational readiness visibility, lifecycle activation/deactivation guardrails, and backend extension/operations standards.

## Scope

- Adds a dedicated authenticated storage administration screen at `/settings/storage`.
- Adds settings-page discoverability for storage administration.
- Adds a thin route-helper seam for admin-lite/deep-link navigation.

## UI surfaces

- Page: `ui/pages/StorageAdministrationPage.tsx`
- Workflow panel: `ui/components/storage/StorageInstanceWorkflowPanel.tsx`
- Service: `ui/services/StorageAdministrationService.ts`
- HTTP client: `ui/shared/storage/StorageAdministrationClient.ts`
- Thin-client/admin-lite route helper: `ui/web/storage/StorageAdministrationRoutes.ts`

## Operational behavior

- List and detail data are loaded only from authoritative storage management API endpoints:
  - `GET /api/v1/storage/instances`
  - `GET /api/v1/storage/instances/:storageInstanceId`
  - `GET /api/v1/storage/instances/:storageInstanceId/health`
- The page renders explicit loading, empty, and error states for list and detail inspection paths.
- Storage list rows project:
  - display name
  - backend type
  - workspace scope
  - lifecycle state
  - health summary
  - sync posture
  - availability summary
  - policy highlights
- Detail panel projects lifecycle, policy, access restrictions, replication status, and health diagnostics.

## Story 9.4.3 operational visibility behavior

- Storage list and detail surfaces now classify readiness as:
  - `healthy` (ready)
  - `degraded` (limited)
  - `inactive` (not usable)
  - `unhealthy` / `unsupported` (blocked)
- Classification is rendered from authoritative storage inspection data (`GET /health`) and lifecycle state without exposing backend internals.
- Detail panel now separates:
  - operational status (availability + usability explanation + reason code + notes)
  - capability profile differences (managed lifecycle and replication/read posture support flags)
  - synchronization posture (sync-capable vs non-sync-capable, deployment availability, sync status)
- Sync-capable storage instances are explicitly distinguishable from non-sync-capable backends in list and detail.
- Unusable status messaging explains why an instance is not ready (inactive, unsupported capability profile, or operational failure), with safe reason-code visibility for operators.

## Story 9.4.2 workflow behavior

- Admin UI now supports create and edit workflows directly on `/settings/storage`.
- Create workflow supports backend type selection, access mode/scope, and policy metadata inputs aligned to transport/domain schema contracts.
- Edit workflow supports metadata-safe updates (`display.displayName`) and allowed policy metadata updates (`policy.labels`) via metadata route.
- Create and edit requests use shared storage request schemas client-side before submit:
  - `parseCreateStorageInstanceRequestDto(...)`
  - `parseUpdateStorageInstanceRequestDto(...)`
- Validation errors from both client schema checks and server API responses are rendered with field-path messaging.
- Destructive/state-changing mutations use explicit user confirmation prompts before request dispatch.
- Workflow state is contract-driven and refreshes authoritative list/detail views after mutation success.

## Story 9.4.4 lifecycle action behavior

- Admin UI now includes explicit lifecycle mutation controls for selected storage instances:
  - `Activate storage` (transitions eligible instances toward `active`)
  - `Deactivate storage` (currently requests transition to `suspended`)
- Lifecycle action availability is derived from both:
  - authoritative access summary actions (`storage.access.allowedActions`)
  - lifecycle transition guardrails (only lifecycle states that can validly activate/deactivate show controls)
- Unauthorized or inapplicable lifecycle actions are not offered in the workflow panel.
- Lifecycle actions require explicit user confirmation with impact messaging before mutation dispatch.
- Lifecycle mutation failures surface server-authoritative feedback, including conflict/invalid-state guidance that instructs operators to refresh and retry from the latest state.
- After lifecycle mutation success, list/detail/health projections are refreshed through the existing mutation completion refresh seam.

## Guardrails

- UI does not reconstruct lifecycle/policy/health semantics outside backend contracts.
- No raw filesystem or backend path material is rendered.
- Health and policy summaries remain user-facing and concise while preserving backend reason codes in detail views.
- Edit flows are constrained to server-allowed metadata fields instead of raw policy/lifecycle mutation payloads.
- Lifecycle controls are intentionally constrained by access summaries and lifecycle-state guardrails to prevent unsafe or unauthorized mutation paths.

## Story 9.4.5 backend extension and operational standards

Storage administration is part of a broader managed-storage platform contract. Contributors extending backend behavior must keep admin flows aligned to the canonical storage architecture seams.

Extension standards:

- backend behavior is introduced through typed adapters and registry composition (`StorageBackendAdapterRegistry`, `StorageBackendProvisioningOrchestrator`), not UI-specific branching.
- domain lifecycle/policy invariants remain authoritative in `StorageDomain` and application services.
- transport validation and API error mapping remain deterministic through shared schema contracts and `StorageManagementApiErrorCodes`.
- UI lifecycle operations remain gated by `access.allowedActions` plus lifecycle transition semantics.
- no endpoint or UI view introduces raw filesystem path exposure or backend internal binding secrets.

Operational assumptions in current host composition:

- `hosts/server/IdentityServerHost.ts` currently composes storage provisioning orchestration with an empty backend registry (`createStorageBackendAdapterRegistry([])`).
- backend provisioning/capability paths therefore return unconfigured posture unless deployment composition explicitly registers backend adapters.
- admin workflows remain valid for metadata/lifecycle management without requiring backend provisioning toggles.
- sync posture is projected as a typed eligibility/state seam; it is not a distributed replication scheduler in this slice.

Contributor workflow for new backends:

1. Extend/confirm domain and policy invariants in `src/domain/storage/StorageDomain.ts`.
2. Implement adapter contracts in `src/infrastructure/storage/*`.
3. Register backend adapter(s) in host composition.
4. Keep API and UI contracts stable by reusing shared storage DTO/schema contracts.
5. Validate operational behavior through storage infrastructure/API/UI regression suites.

## Verification

- `ui/shared/storage/tests/StorageAdministrationClient.test.ts`
- `ui/components/storage/tests/StorageInstanceWorkflowPanel.test.tsx`
- `ui/services/tests/StorageAdministrationService.test.ts`
- `ui/pages/tests/StorageAdministrationPage.test.tsx`
- `ui/pages/tests/StorageAdministrationPage.presentation.test.ts`
- `ui/web/storage/tests/StorageAdministrationRoutes.test.ts`
- route/page contract updates:
  - `ui/routes/tests/RoutesContracts.test.ts`
  - `ui/pages/tests/PagesContracts.test.ts`
- storage backend/orchestration guardrails:
  - `src/infrastructure/storage/tests/StorageBackendAdapterRegistry.test.ts`
  - `src/infrastructure/storage/tests/StorageBackendProvisioningOrchestrator.test.ts`
- architecture extension guidance:
  - `docs/architecture/storage-feature-extension-guidance.md`
