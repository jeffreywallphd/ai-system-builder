# Feature 6 Final Baseline: Result Persistence, Preview, and Lineage

This document records Feature 6 completion for the image manipulation vertical slice and locks the implementation-truth baseline for Epic 6.4 Story 6.4.4.

Feature 6 is the point where generated outputs stop being backend-local execution artifacts and become durable first-class platform resources. This baseline is required before sharing/export/admin workflows and broader multi-surface result experiences build on top.

## Feature 6 verification summary

Feature 6 is complete for result persistence, preview, and lineage in the image slice:

- run outputs are persisted as authoritative generated-result assets with canonical ids and lifecycle states
- result lineage is explicit from result asset to run/workflow/system/optional execution node and upstream input assets
- run terminal finalization uses an explicit non-blocking result-persistence handoff seam
- protected original retrieval is authenticated, policy-checked, and storage-topology-opaque
- preview generation and retrieval use explicit derivative lifecycle states and protected handles
- studio gallery/history/detail experiences consume authoritative generated-result APIs and lineage projections
- result metadata includes reuse/source-selection seams for future workflow-input binding
- result persistence and protected access flows emit redacted authoritative audit events

## Canonical result-asset model and collection handoff

Core domain and orchestration seams:

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/GeneratedResultAssetDerivativeDomain.ts`
- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter.ts`

Model posture:

- `resultAssetId` is the canonical identity for generated outputs.
- result lifecycle is explicit (`pending-collection`, `available`, `preview-ready`, `failed-collection`, `archived`).
- backend adapter output handles are transitional and are not authoritative persisted identity.
- finalization remains authoritative/non-blocking while result persistence emits explicit degraded/partial states.

## Lineage model and retrieval posture

Canonical lineage/read seams:

- `src/application/generated-results/use-cases/GetGeneratedResultLineageSummaryUseCase.ts`
- `src/application/generated-results/use-cases/GetGeneratedResultLineageDetailUseCase.ts`
- `src/application/generated-results/use-cases/GeneratedResultLineageProjection.ts`

Lineage posture:

- lineage remains pointer-based (`runId`, `workflowId`, `systemId`, optional `executionNodeId`, `outputSlot`, input asset ids) rather than duplicating full upstream records.
- immutable provenance refs (workflow template/system snapshots, parameter snapshot, execution adapter/backend metadata) are queryable for audit/reuse/debug.
- lineage retrieval is workspace/visibility aware and assembled from authoritative generated-result persistence records.

## Protected retrieval and preview-safe access posture

Canonical retrieval and preview seams:

- `src/application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCase.ts`
- `src/application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCase.ts`
- `src/application/generated-results/use-cases/RequestGeneratedResultPreviewContentUseCase.ts`
- `src/application/generated-results/use-cases/OpenGeneratedResultPreviewContentUseCase.ts`
- `src/infrastructure/media/generated-results/SharpGeneratedResultPreviewImageProcessor.ts`
- `src/infrastructure/media/generated-results/TokenizedGeneratedResultPreviewAccessPort.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

Retrieval posture:

- original retrieval is authenticated and mediated through logical storage access resolution/object ports.
- preview descriptors expose protected handles only and do not leak filesystem/object-key topology.
- explicit preview states (`preview-available`, `preview-pending`, `preview-failed`, `preview-unavailable`) are authoritative client contracts.

## Gallery/history integration and reuse seams

Canonical gallery/reuse seams:

- `src/application/generated-results/use-cases/GetGeneratedResultMetadataUseCase.ts`
- `src/application/generated-results/use-cases/ListGeneratedResultMetadataUseCase.ts`
- `src/infrastructure/api/generated-results/GeneratedResultManagementBackendApi.ts`
- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`

Integration posture:

- gallery/history/list/detail flows are driven by generated-result APIs (`list/get/by-run`) and not by local execution payload caches.
- detail/lineage inspector uses authoritative lineage projections keyed by `resultAssetId`.
- reuse-oriented filters and metadata (`reuseReadyOnly`, required classes/media/purposes, lineage-input filters) provide stable source-selection seams for follow-on workflow-input UX.

## Audit posture

Canonical audit seams:

- `src/application/generated-results/ports/GeneratedResultAuditPort.ts`
- `src/infrastructure/audit/AuthoritativeGeneratedResultAuditSink.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`

Audit posture:

- result persistence, preview-generation outcomes, and protected original/preview access emit authoritative audit events.
- payloads include bounded lineage-sensitive identifiers and redact tokens/content/storage internals.
- audit capture remains best-effort and does not block run/result control-plane progression.

## Architectural boundaries and assumptions

- generated-result assets are the single source of truth for persisted run outputs in this slice
- run/workflow/system domains remain canonical owners of full upstream records; generated-result lineage points to them
- application services orchestrate policy/lifecycle behavior; infrastructure owns persistence/media/storage adapter details
- storage references remain logical and protected-resource mediated; UI and API contracts must stay storage-topology-opaque
- result, preview, and lineage states are explicit and durable; consumers must not infer hidden implicit state transitions

## Follow-on dependencies and extension points

Follow-on sharing/export/admin work should:

- consume generated-result list/get/by-run + lineage + protected preview/original flows as the integration base
- preserve `resultAssetId` and lineage pointer semantics in share/export/admin records
- extend access-handle policy behavior (expiry/revocation/scope) behind current preview/original access ports
- add derivative profiles or background processing through preview-generation ports, not by bypassing generated-result lifecycle
- reuse audit event categories and sanitizer posture for governance-sensitive share/export/admin actions

## Known limits and intentional non-goals

Known limits:

- preview generation currently relies on available media/storage dependencies and is not yet a dedicated background-worker subsystem
- preview and retrieval availability may degrade independently from durable result persistence
- list/query performance is adapter-bounded (SQLite) and does not include a separate indexing/search service
- sharing/export/admin flows are intentionally follow-on integrations over this baseline and not part of Feature 6 scope

Intentional non-goals:

- backend-local file/path serving as public result retrieval contracts
- UI-only galleries or history panels that bypass generated-result authoritative APIs
- result-model forks for gallery/history/reuse/admin; all should compose the same generated-result baseline
- embedding full run/workflow/system payload copies into generated-result persistence records

## Verification coverage and cross-references

Primary regression and integration coverage:

- `src/domain/image-assets/tests/GeneratedResultAssetDomain.test.ts`
- `src/domain/image-assets/tests/GeneratedResultAssetDerivativeDomain.test.ts`
- `src/application/generated-results/tests/GetGeneratedResultMetadataUseCase.test.ts`
- `src/application/generated-results/tests/ListGeneratedResultMetadataUseCase.test.ts`
- `src/application/generated-results/tests/GetGeneratedResultOriginalContentUseCase.test.ts`
- `src/application/generated-results/tests/GeneratedResultPreviewContentUseCases.test.ts`
- `src/application/generated-results/tests/GenerateGeneratedResultPreviewUseCase.integration.test.ts`
- `src/application/generated-results/tests/GetGeneratedResultLineageUseCases.test.ts`
- `src/application/generated-results/tests/GeneratedResultAuditPort.test.ts`
- `src/application/generated-results/tests/GeneratedResultServiceFlows.integration.test.ts`
- `src/infrastructure/persistence/generated-results/tests/SqliteGeneratedResultPersistenceAdapter.test.ts`
- `src/infrastructure/persistence/generated-results/tests/SqliteRunCollectedResultPersistenceAdapter.test.ts`
- `src/infrastructure/api/generated-results/tests/GeneratedResultManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerGeneratedResultManagement.test.ts`
- `src/infrastructure/media/generated-results/tests/SharpGeneratedResultPreviewImageProcessor.test.ts`
- `src/infrastructure/media/generated-results/tests/TokenizedGeneratedResultPreviewAccessPort.test.ts`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`

Related architecture and contributor docs:

- `docs/architecture/generated-result-asset-domain-foundation.md`
- `docs/architecture/generated-result-api-contracts.md`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`
- `docs/architecture/image-manipulation-studio-feature-7-ux-composition-posture.md`
- `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md`
- `docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md`
- `docs/architecture/shared-asset-contracts.md`
- `docs/architecture/storage-logical-access-resolution.md`
- `docs/audit-governance-contributor-guide.md`
