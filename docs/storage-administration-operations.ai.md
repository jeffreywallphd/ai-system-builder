# AI Companion: Storage Administration Screens

## Scope

- Story 9.4.1 initial storage admin UI implementation.
- Story 9.4.2 create/edit workflow implementation for managed storage instances.
- Story 9.4.3 operational status/capability/sync posture presentation.
- Story 9.4.4 lifecycle activation/deactivation controls with safety confirmations.
- Story 9.4.5 backend extension guidance and operational standards.
- Story 11.3.1 policy-field alignment for encryption-at-rest administration inputs.
- Story 11.3.4 encryption policy enforcement audit + diagnostics additions.
- Adds list/detail inspection plus create/edit administration workflows.

## Canonical files

- `src/ui/pages/StorageAdministrationPage.tsx`
- `src/ui/components/storage/StorageInstanceWorkflowPanel.tsx`
- `src/ui/services/StorageAdministrationService.ts`
- `src/ui/shared/storage/StorageAdministrationClient.ts`
- `src/ui/web/storage/StorageAdministrationRoutes.ts`

## Behavior summary

- Authenticated admin UI route: `/settings/storage` (`ROUTE_PATHS.storageAdmin`).
- Uses authoritative storage API endpoints only (`list`, `detail`, `health`).
- Uses authoritative storage API endpoints for mutation flows (`create`, `metadata update`) in addition to list/detail/health.
- List view projects:
  - name
  - backend type
  - workspace scope
  - lifecycle
  - health summary
  - sync posture
  - availability summary
  - policy highlights
- Detail view projects lifecycle/access/policy/replication/health contracts with explicit loading/empty/error handling.
- Story 9.4.3 adds inspection-driven readiness rendering:
  - `healthy`, `degraded`, `inactive`, and `unhealthy/unsupported` distinctions
  - operational usability messaging for non-usable instances
  - capability profile summary using contract-safe support flags
  - synchronization posture clarity (sync-capable vs not, deployment availability, sync status)
- Create workflow captures backend/access/policy metadata and validates via shared storage schema contracts before submit.
- Edit workflow updates allowed metadata/policy-label fields only and validates via shared storage schema contracts.
- Story 11.3.1 extends create/edit policy payload handling to include explicit security/lifecycle policy fragments:
  - `policy.security.encryptionMode`
  - `policy.security.contentEncryptionRequired`
  - `policy.security.keyScope`
  - `policy.security.allowPreviewDecryption`
  - `policy.security.allowWorkerDecryption`
  - `policy.lifecycle.retentionExpiryAction`
  - `policy.lifecycle.purgeGracePeriodDays`
- Mutation flows apply confirmation prompts and render API validation feedback with path-level detail.
- Story 9.4.4 adds lifecycle controls for selected storage details:
  - activate and deactivate actions are surfaced only when both access summaries and lifecycle state rules allow them
  - lifecycle actions require explicit confirmation with operational impact messaging
  - conflict/invalid-state responses from the server are surfaced as operator guidance to refresh/retry from current authoritative state
  - mutation success paths trigger authoritative list/detail refresh through existing mutation-complete seams

## Boundary posture

- Renderer remains thin and contract-driven through client/service seams.
- No renderer-owned path or backend binding internals are exposed.
- Lifecycle, policy, and health semantics remain backend-authoritative.
- Client/server validation posture stays aligned through shared storage transport schema parsers.

## Story 9.4.5 operations posture

- Storage backend extension now has a canonical contributor guide: `docs/architecture/storage-feature-extension-guidance.md`.
- Host composition currently wires storage provisioning orchestration with an empty backend registry (`createStorageBackendAdapterRegistry([])` in `IdentityServerHost`), so provisioning/capability paths are intentionally unconfigured unless deployment composition registers adapters.
- Admin workflows remain contract-safe under this posture because lifecycle/metadata flows are policy- and schema-governed even when backend provisioning toggles are off.
- Regression expectation now explicitly includes storage backend registry/orchestrator test suites to guard extension safety.

## Tests

- `src/ui/shared/storage/tests/StorageAdministrationClient.test.ts`
- `src/ui/components/storage/tests/StorageInstanceWorkflowPanel.test.tsx`
- `src/ui/services/tests/StorageAdministrationService.test.ts`
- `src/ui/pages/tests/StorageAdministrationPage.test.tsx`
- `src/ui/pages/tests/StorageAdministrationPage.presentation.test.ts`
- `src/ui/web/storage/tests/StorageAdministrationRoutes.test.ts`
- `src/infrastructure/storage/tests/StorageBackendAdapterRegistry.test.ts`
- `src/infrastructure/storage/tests/StorageBackendProvisioningOrchestrator.test.ts`

## Story 11.3.4 operator note

- Storage policy mutation audit events now include encryption-policy diff summaries (`changedSecurityFields`, `changedEncryptionFields`, `encryptionPolicyChanged`) for troubleshooting policy posture changes.
- Runtime encryption enforcement diagnostics now cover:
  - protected writes in asset upload ingestion
  - preview/worker decryption grant/deny decisions in asset download flows
  - policy and key-scope resolution outcomes in encryption services
- Redaction contract remains strict: no plaintext/payload content, no raw key material, no raw key references, and no unsafe object/file path details in diagnostics.
