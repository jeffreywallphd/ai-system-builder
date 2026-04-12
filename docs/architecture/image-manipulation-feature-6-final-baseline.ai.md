# AI Companion: Feature 6 Final Baseline for Result Persistence, Preview, and Lineage

## Purpose

Provide implementation-truth completion verification for Feature 6 so sharing/export/admin and broader multi-surface experiences build on durable generated-result assets instead of backend-local output assumptions.

## Canonical source doc

- `docs/architecture/image-manipulation-feature-6-final-baseline.md`

## Completion posture summary

- Backend-produced execution outputs are now persisted as authoritative generated-result assets with durable ids and lifecycle states.
- Lineage is explicit and queryable from result assets back to run, workflow, system, optional execution node, and upstream input assets.
- Run finalization handoff into result persistence is application-owned and non-blocking for terminal run lifecycle closure.
- Original and preview retrieval are protected, authenticated, and storage-topology-opaque.
- Preview generation and preview retrieval use explicit derivative lifecycle states and protected access handles.
- Studio gallery/history and detail surfaces consume authoritative generated-result APIs instead of UI-local or adapter-local output blobs.
- Result metadata now exposes reuse/source-selection seams for follow-on workflow-input binding.
- Result persistence and protected access flows emit redacted audit events through authoritative audit services.

## Canonical seams

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/GeneratedResultAssetDerivativeDomain.ts`
- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts`
- `src/application/generated-results/use-cases/GetGeneratedResultMetadataUseCase.ts`
- `src/application/generated-results/use-cases/ListGeneratedResultMetadataUseCase.ts`
- `src/application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCase.ts`
- `src/application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCase.ts`
- `src/application/generated-results/use-cases/RequestGeneratedResultPreviewContentUseCase.ts`
- `src/application/generated-results/use-cases/OpenGeneratedResultPreviewContentUseCase.ts`
- `src/application/generated-results/use-cases/GetGeneratedResultLineageSummaryUseCase.ts`
- `src/application/generated-results/use-cases/GetGeneratedResultLineageDetailUseCase.ts`
- `src/infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter.ts`
- `src/infrastructure/persistence/generated-results/SqliteGeneratedResultPersistenceAdapter.ts`
- `src/infrastructure/api/generated-results/GeneratedResultManagementBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/audit/AuthoritativeGeneratedResultAuditSink.ts`
- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`

## Architectural boundaries and assumptions

- Generated results are authoritative only after persistence as generated-result assets (`resultAssetId` + lifecycle + lineage), not when first discovered by backend adapters.
- Backend/local file handles are transitional handoff metadata and must not become canonical ids or API-visible retrieval references.
- Domain/contracts own result lifecycle and lineage invariants; application owns orchestration; infrastructure owns storage/media/token adapters.
- Preview descriptors are derivatives of a result asset, not independent result authorities.
- Run terminal lifecycle remains authoritative and non-blocking even when result persistence/preview work is partial or failed.

## Follow-on dependency and extension points

Sharing/export/admin and broader multi-surface follow-on work must extend these seams:

- Consume generated-result APIs (`list/get/by-run`, preview/original retrieval, lineage summary/detail) as authoritative source.
- Reuse protected-resource access patterns (request/open, expiring handles, no storage-path exposure) for share/download/export endpoints.
- Preserve `resultAssetId` + lineage pointers when projecting admin/governance/export records.
- Extend preview-generation profiles and access-handle implementations behind existing ports, not by introducing direct storage URL paths.
- Build source-selection and reuse workflows through existing reuse metadata filters (`reuseReadyOnly`, required classes/media/purposes, lineage input filters).
- Extend auditing via generated-result audit port/sink categories rather than adding ad-hoc logging-only telemetry.

## Known limits and intentional non-goals

Known limits:

- Preview generation currently depends on in-process media processing and configured storage accessibility; large-batch/background scaling is not yet a dedicated worker subsystem.
- Preview provisioning and retrieval readiness can be temporarily degraded while original-content authority remains intact.
- Result list/query performance and pagination behavior are SQLite-adapter bounded; no separate search/index service is part of this feature.
- Sharing/export/admin projections are not first-class write paths yet; they are expected follow-on integrations over current authoritative result seams.

Intentional non-goals for Feature 6:

- direct backend-local file serving from adapters or UI surfaces
- UI-only output galleries disconnected from authoritative generated-result APIs
- embedding full run/workflow/system payload snapshots into result records instead of pointer-based lineage
- introducing separate result-asset models for gallery vs history vs reuse

## Verification anchors

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

## Related docs

- `docs/architecture/generated-result-asset-domain-foundation.md`
- `docs/architecture/generated-result-api-contracts.md`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`
- `docs/architecture/image-manipulation-studio-feature-7-ux-composition-posture.md`
- `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md`
- `docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md`
- `docs/architecture/shared-asset-contracts.md`
- `docs/architecture/storage-logical-access-resolution.md`
- `docs/audit-governance-contributor-guide.md`
