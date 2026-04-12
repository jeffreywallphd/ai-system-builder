import type { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { GenerateGeneratedResultPreviewUseCase } from "@application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCase";
import { GetGeneratedResultOriginalContentUseCase } from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCase";
import { GetGeneratedResultMetadataUseCase } from "@application/generated-results/use-cases/GetGeneratedResultMetadataUseCase";
import { GetGeneratedResultLineageDetailUseCase } from "@application/generated-results/use-cases/GetGeneratedResultLineageDetailUseCase";
import { GetGeneratedResultLineageSummaryUseCase } from "@application/generated-results/use-cases/GetGeneratedResultLineageSummaryUseCase";
import { ListGeneratedResultMetadataUseCase } from "@application/generated-results/use-cases/ListGeneratedResultMetadataUseCase";
import { OpenGeneratedResultPreviewContentUseCase } from "@application/generated-results/use-cases/OpenGeneratedResultPreviewContentUseCase";
import { RequestGeneratedResultPreviewContentUseCase } from "@application/generated-results/use-cases/RequestGeneratedResultPreviewContentUseCase";
import { AuthoritativeGeneratedResultAuditSink } from "@infrastructure/audit/AuthoritativeGeneratedResultAuditSink";
import { GeneratedResultManagementBackendApi } from "@infrastructure/api/generated-results/GeneratedResultManagementBackendApi";
import { TokenizedGeneratedResultPreviewAccessPort } from "@infrastructure/media/generated-results/TokenizedGeneratedResultPreviewAccessPort";
import { SharpGeneratedResultPreviewImageProcessor } from "@infrastructure/media/generated-results/SharpGeneratedResultPreviewImageProcessor";
import { SqliteRunCollectedResultPersistenceAdapter } from "@infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { StorageLogicalAccessResolutionService } from "@application/storage/use-cases/StorageLogicalAccessResolutionService";
import type { SecurityMaterialStartupValidationResult } from "@application/security/services/SecurityMaterialStartupValidationPipeline";
import { resolveCriticalServerSecurityMaterial } from "./ResolveCriticalServerSecurityMaterial";

export interface ServerGeneratedResultCompositionModuleInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly startupSecurityMaterialValidation?: SecurityMaterialStartupValidationResult;
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly workspaceClock: {
    now(): Date;
  };
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly storageLogicalAccessResolutionService: StorageLogicalAccessResolutionService;
  readonly securityMaterialLogger?: {
    warn(event: Readonly<Record<string, unknown>>): void;
  };
}

export interface ServerGeneratedResultCompositionModuleOutput {
  readonly generatedResultManagementBackendApi: GeneratedResultManagementBackendApi;
  readonly runCollectedResultPersistencePort: SqliteRunCollectedResultPersistenceAdapter;
}

export function composeServerGeneratedResultCompositionModule(
  input: ServerGeneratedResultCompositionModuleInput,
): ServerGeneratedResultCompositionModuleOutput {
  const generatedResultPreviewTokenSecret = resolveCriticalServerSecurityMaterial({
    environment: input.env,
    materialId: "material:server:generated-result-preview-access-token-secret",
    environmentKey: "AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    startupSecurityMaterialValidation: input.startupSecurityMaterialValidation,
    logger: input.securityMaterialLogger,
    materialFormat: "string-secret",
  });
  const generatedResultPreviewAccessPort = new TokenizedGeneratedResultPreviewAccessPort(
    generatedResultPreviewTokenSecret,
  );
  const generatedResultAuditSink = new AuthoritativeGeneratedResultAuditSink(input.authoritativeAuditRecorder);
  const generatedResultPreviewGenerationUseCase = new GenerateGeneratedResultPreviewUseCase({
    generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
    storageLogicalAccessResolutionService: input.storageLogicalAccessResolutionService,
    previewImageProcessorPort: new SharpGeneratedResultPreviewImageProcessor(),
    previewAccessPort: generatedResultPreviewAccessPort,
    auditSink: generatedResultAuditSink,
    clock: input.workspaceClock,
  });

  const generatedResultManagementBackendApi = new GeneratedResultManagementBackendApi({
    listGeneratedResultMetadataUseCase: new ListGeneratedResultMetadataUseCase({
      generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
    }),
    getGeneratedResultMetadataUseCase: new GetGeneratedResultMetadataUseCase({
      generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
    }),
    getGeneratedResultOriginalContentUseCase: new GetGeneratedResultOriginalContentUseCase({
      generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
      storageLogicalAccessResolutionService: input.storageLogicalAccessResolutionService,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      auditSink: generatedResultAuditSink,
      clock: input.workspaceClock,
    }),
    requestGeneratedResultPreviewContentUseCase: new RequestGeneratedResultPreviewContentUseCase({
      generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      auditSink: generatedResultAuditSink,
      clock: input.workspaceClock,
    }),
    openGeneratedResultPreviewContentUseCase: new OpenGeneratedResultPreviewContentUseCase({
      generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
      storageLogicalAccessResolutionService: input.storageLogicalAccessResolutionService,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      previewAccessPort: generatedResultPreviewAccessPort,
      auditSink: generatedResultAuditSink,
      clock: input.workspaceClock,
    }),
    getGeneratedResultLineageSummaryUseCase: new GetGeneratedResultLineageSummaryUseCase({
      generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      clock: input.workspaceClock,
    }),
    getGeneratedResultLineageDetailUseCase: new GetGeneratedResultLineageDetailUseCase({
      generatedResultRepository: input.persistentPlatformServices.generatedResultRepository,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      clock: input.workspaceClock,
    }),
  });

  const runCollectedResultPersistencePort = new SqliteRunCollectedResultPersistenceAdapter({
    repository: input.persistentPlatformServices.generatedResultRepository,
    generateGeneratedResultPreviewUseCase: generatedResultPreviewGenerationUseCase,
    auditSink: generatedResultAuditSink,
    now: () => input.workspaceClock.now(),
  });

  return Object.freeze({
    generatedResultManagementBackendApi,
    runCollectedResultPersistencePort,
  });
}
