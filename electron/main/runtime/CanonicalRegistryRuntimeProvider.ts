import path from "node:path";
import { ListPersistedWorkflowsUseCase } from "../../../src/application/workflow-persistence/ListPersistedWorkflowsUseCase";
import { SqliteAssetSystemRepository } from "../../../src/infrastructure/filesystem/SqliteAssetSystemRepository";
import type { DeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";
import type { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
import type {
  ExplainCanonicalVersionExistenceUseCase,
  GetCanonicalProvenanceSummaryUseCase,
  ListCanonicalAssetsUseCase,
  LoadCanonicalAssetDetailUseCase,
} from "../../../src/application/assets-system/CanonicalAssetReadUseCases";
import type { GetAssetVersionHistoryUseCase } from "../../../src/application/assets-system/GetAssetVersionHistoryUseCase";
import type { GetCanonicalDependencyStateUseCase } from "../../../src/application/assets-system/CanonicalDependencyStateUseCase";
import type { ReplayScopedAssetGraphProjectionUseCase } from "../../../src/application/assets-system/ReconciliationUseCases";
import type { VerifyAssetGraphProjectionUseCase } from "../../../src/application/assets-system/VerifyAssetGraphProjectionUseCase";
import type { ProjectionTrustReadModelService } from "../../../src/application/assets-system/ProjectionTrustReadModelService";
import type { ProjectionRebuildOrchestrationUseCase } from "../../../src/application/assets-system/ProjectionRebuildOrchestrationUseCase";
import type { LoadCanonicalAssetManagementSnapshotUseCase } from "../../../src/application/assets-system/LoadCanonicalAssetManagementSnapshotUseCase";
import type { ReconcileCanonicalIdentityMappingsUseCase } from "../../../src/application/assets-system/ReconciliationUseCases";
import type { RegistryBackendApi } from "../../../src/infrastructure/api/registry/RegistryBackendApi";

export type CanonicalRegistryRuntime = {
  readonly repository: SqliteAssetSystemRepository;
  readonly listCanonicalAssetsUseCase: ListCanonicalAssetsUseCase;
  readonly loadCanonicalAssetDetailUseCase: LoadCanonicalAssetDetailUseCase;
  readonly getVersionHistoryUseCase: GetAssetVersionHistoryUseCase;
  readonly dependencyStateUseCase: GetCanonicalDependencyStateUseCase;
  readonly replayScopedProjectionUseCase: ReplayScopedAssetGraphProjectionUseCase;
  readonly verifyProjectionUseCase: VerifyAssetGraphProjectionUseCase;
  readonly projectionTrustReadModelService: ProjectionTrustReadModelService;
  readonly rebuildProjectionOrchestrationUseCase: ProjectionRebuildOrchestrationUseCase;
  readonly loadManagementSnapshotUseCase: LoadCanonicalAssetManagementSnapshotUseCase;
  readonly reconcileIdentityUseCase: ReconcileCanonicalIdentityMappingsUseCase;
  readonly registryBackendApi: RegistryBackendApi;
};

export type CanonicalRegistryRuntimeProvider = {
  readonly ensureCanonicalRegistryRuntime: () => Promise<CanonicalRegistryRuntime>;
  readonly dispose: () => void;
};

export function createCanonicalRegistryRuntimeProvider(params: {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly getDeferredFeatureRuntime: () => DeferredDesktopFeatureRuntime | undefined;
  readonly onRuntimeReady?: () => void;
}): CanonicalRegistryRuntimeProvider {
  let canonicalRegistryRuntime: CanonicalRegistryRuntime | undefined;

  async function ensureCanonicalRegistryRuntime(): Promise<CanonicalRegistryRuntime> {
    if (canonicalRegistryRuntime) {
      return canonicalRegistryRuntime;
    }
    const runtime = params.getDeferredFeatureRuntime();
    if (!runtime) {
      throw new Error("Deferred desktop feature runtime is unavailable.");
    }
    const systemRuntimeBackendApi = runtime.ensureSystemRuntimeBackendApi();
    const [
      { InMemoryAssetLineageGraphProjectionSink },
      { ExplainCanonicalVersionExistenceUseCase, GetCanonicalProvenanceSummaryUseCase, ListCanonicalAssetsUseCase, LoadCanonicalAssetDetailUseCase },
      { GetAssetVersionHistoryUseCase },
      { GetCanonicalDependencyStateUseCase },
      { GetAssetDependencyHealthUseCase },
      { GetAssetImpactAnalysisUseCase },
      { ReconcileCanonicalIdentityMappingsUseCase, ReplayScopedAssetGraphProjectionUseCase },
      { ReplayAssetGraphProjectionUseCase },
      { VerifyAssetGraphProjectionUseCase },
      { ProjectionRebuildOrchestrationUseCase },
      { LoadCanonicalAssetManagementSnapshotUseCase },
      { ProjectionTrustReadModelService },
      { RegistryBackendApi },
      { RegistryQueryService },
      { CrossStudioRegistryQueryService },
      { RegistryDependencyGraphService },
      { RegistryCacheLayer },
      { CompositionAssetContractResolver },
    ] = await Promise.all([
      import("../../../src/infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink"),
      import("../../../src/application/assets-system/CanonicalAssetReadUseCases"),
      import("../../../src/application/assets-system/GetAssetVersionHistoryUseCase"),
      import("../../../src/application/assets-system/CanonicalDependencyStateUseCase"),
      import("../../../src/application/assets-system/GetAssetDependencyHealthUseCase"),
      import("../../../src/application/assets-system/GetAssetImpactAnalysisUseCase"),
      import("../../../src/application/assets-system/ReconciliationUseCases"),
      import("../../../src/application/assets-system/ReplayAssetGraphProjectionUseCase"),
      import("../../../src/application/assets-system/VerifyAssetGraphProjectionUseCase"),
      import("../../../src/application/assets-system/ProjectionRebuildOrchestrationUseCase"),
      import("../../../src/application/assets-system/LoadCanonicalAssetManagementSnapshotUseCase"),
      import("../../../src/application/assets-system/ProjectionTrustReadModelService"),
      import("../../../src/infrastructure/api/registry/RegistryBackendApi"),
      import("../../../src/application/asset-registry/RegistryQueryService"),
      import("../../../src/application/asset-registry/CrossStudioRegistryQueryService"),
      import("../../../src/application/asset-registry/RegistryDependencyGraphService"),
      import("../../../src/application/asset-registry/RegistryCacheLayer"),
      import("../../../src/application/contracts/CompositionAssetContractResolver"),
    ]);

    const repository = new SqliteAssetSystemRepository(path.join(params.storagePaths.assetsDirectory, "asset-system.sqlite"));
    const projectionSink = new InMemoryAssetLineageGraphProjectionSink();
    const listCanonicalAssetsUseCase = new ListCanonicalAssetsUseCase(repository, repository);
    const loadCanonicalAssetDetailUseCase = new LoadCanonicalAssetDetailUseCase(repository, repository, repository, repository, repository);
    const getVersionHistoryUseCase = new GetAssetVersionHistoryUseCase(repository);
    const explainVersionExistenceUseCase = new ExplainCanonicalVersionExistenceUseCase(
      new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
      repository,
    );
    const dependencyStateUseCase = new GetCanonicalDependencyStateUseCase(
      repository,
      repository,
      new GetAssetDependencyHealthUseCase(repository, repository, repository),
      new GetAssetImpactAnalysisUseCase(repository, repository, repository),
      new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
      repository,
    );
    const replayProjectionUseCase = new ReplayAssetGraphProjectionUseCase(repository, projectionSink);
    const replayScopedProjectionUseCase = new ReplayScopedAssetGraphProjectionUseCase(repository, replayProjectionUseCase);
    const verifyProjectionUseCase = new VerifyAssetGraphProjectionUseCase(repository, projectionSink);
    const projectionTrustReadModelService = new ProjectionTrustReadModelService();
    const rebuildProjectionOrchestrationUseCase = new ProjectionRebuildOrchestrationUseCase(
      replayScopedProjectionUseCase,
      replayProjectionUseCase,
      verifyProjectionUseCase,
    );
    const loadManagementSnapshotUseCase = new LoadCanonicalAssetManagementSnapshotUseCase(
      loadCanonicalAssetDetailUseCase,
      getVersionHistoryUseCase,
      dependencyStateUseCase,
      explainVersionExistenceUseCase,
      verifyProjectionUseCase,
    );
    const registryCacheLayer = new RegistryCacheLayer({ maxEntriesPerNamespace: 300 });
    const registryQueryService = new RegistryQueryService(
      repository,
      repository,
      repository,
      new CompositionAssetContractResolver(),
      repository,
      undefined,
      registryCacheLayer,
      repository,
      {
        async listRecentExecutionsForSystem(input) {
          const response = await systemRuntimeBackendApi.listRecentExecutionsForSystem(input);
          return response.ok && response.data ? response.data : [];
        },
      },
    );
    const registryBackendApi = new RegistryBackendApi(
      new CrossStudioRegistryQueryService(registryQueryService),
      new RegistryDependencyGraphService(registryQueryService, repository, repository, registryCacheLayer),
      new ListPersistedWorkflowsUseCase(runtime.ensureWorkflowPersistenceRepository()),
    );
    canonicalRegistryRuntime = {
      repository,
      listCanonicalAssetsUseCase,
      loadCanonicalAssetDetailUseCase,
      getVersionHistoryUseCase,
      dependencyStateUseCase,
      replayScopedProjectionUseCase,
      verifyProjectionUseCase,
      projectionTrustReadModelService,
      rebuildProjectionOrchestrationUseCase,
      loadManagementSnapshotUseCase,
      reconcileIdentityUseCase: new ReconcileCanonicalIdentityMappingsUseCase(repository, repository),
      registryBackendApi,
    };
    params.onRuntimeReady?.();
    return canonicalRegistryRuntime;
  }

  function dispose(): void {
    const repository = canonicalRegistryRuntime?.repository as { dispose?: () => void } | undefined;
    if (typeof repository?.dispose === "function") {
      repository.dispose();
    }
    canonicalRegistryRuntime = undefined;
  }

  return Object.freeze({
    ensureCanonicalRegistryRuntime,
    dispose,
  });
}
