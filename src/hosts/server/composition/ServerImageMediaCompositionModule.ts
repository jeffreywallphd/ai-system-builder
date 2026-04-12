import type { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { FinalizeImageAssetUploadUseCase } from "@application/image-assets/use-cases/FinalizeImageAssetUploadUseCase";
import { GetImageAssetMetadataUseCase } from "@application/image-assets/use-cases/GetImageAssetMetadataUseCase";
import { GetImageAssetOriginalContentUseCase } from "@application/image-assets/use-cases/GetImageAssetOriginalContentUseCase";
import { OpenImageAssetPreviewContentUseCase } from "@application/image-assets/use-cases/OpenImageAssetPreviewContentUseCase";
import { RequestImageAssetPreviewContentUseCase } from "@application/image-assets/use-cases/RequestImageAssetPreviewContentUseCase";
import { InitiateImageAssetCreationUseCase } from "@application/image-assets/use-cases/InitiateImageAssetCreationUseCase";
import { ListImageAssetMetadataUseCase } from "@application/image-assets/use-cases/ListImageAssetMetadataUseCase";
import { AuthoritativeImageAssetAuditSink } from "@infrastructure/audit/AuthoritativeImageAssetAuditSink";
import { ImageAssetManagementBackendApi } from "@infrastructure/api/image-assets/ImageAssetManagementBackendApi";
import { ImageAssetManagementObservability } from "@infrastructure/api/image-assets/ImageAssetManagementObservability";
import type { WorkspaceAwareStoragePolicyEvaluationAdapter } from "@infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter";
import type { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { SqliteImageAssetPersistenceAdapter } from "@infrastructure/persistence/image-assets/SqliteImageAssetPersistenceAdapter";
import { ManagedImageAssetStorageAdapter } from "@infrastructure/storage/image-assets/ManagedImageAssetStorageAdapter";
import type { StorageLogicalAccessResolutionService } from "@application/storage/use-cases/StorageLogicalAccessResolutionService";
import type { SecurityMaterialStartupValidationResult } from "@application/security/services/SecurityMaterialStartupValidationPipeline";
import { resolveCriticalServerSecurityMaterial } from "./ResolveCriticalServerSecurityMaterial";

export interface ServerImageMediaCompositionModuleInput {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly startupSecurityMaterialValidation?: SecurityMaterialStartupValidationResult;
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly authorizationDecisionEvaluator: AuthorizationPolicyDecisionEvaluator;
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly imageAssetObservabilityLogger?: {
    info(event: Record<string, unknown>): void;
    warn(event: Record<string, unknown>): void;
    error(event: Record<string, unknown>): void;
  };
  readonly storageLogicalAccessResolutionService: StorageLogicalAccessResolutionService;
  readonly workspaceAwareStoragePolicyEvaluationAdapter: WorkspaceAwareStoragePolicyEvaluationAdapter;
}

export interface ServerImageMediaCompositionModuleOutput {
  readonly imageAssetManagementBackendApi: ImageAssetManagementBackendApi;
  dispose(): void;
}

export function composeServerImageMediaCompositionModule(
  input: ServerImageMediaCompositionModuleInput,
): ServerImageMediaCompositionModuleOutput {
  const imageAssetRepository = new SqliteImageAssetPersistenceAdapter(input.databasePath);
  const imageAssetStorageTokenSecret = resolveCriticalServerSecurityMaterial({
    environment: input.env,
    materialId: "material:server:image-asset-storage-token-secret",
    environmentKey: "AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    startupSecurityMaterialValidation: input.startupSecurityMaterialValidation,
    logger: input.imageAssetObservabilityLogger,
    materialFormat: "string-secret",
  });
  const imageAssetUploadSessionTokenSecret = resolveCriticalServerSecurityMaterial({
    environment: input.env,
    materialId: "material:server:image-upload-session-token-secret",
    environmentKey: "AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    startupSecurityMaterialValidation: input.startupSecurityMaterialValidation,
    logger: input.imageAssetObservabilityLogger,
    materialFormat: "string-secret",
  });
  const imageAssetStorageAdapter = new ManagedImageAssetStorageAdapter({
    storageLogicalAccessResolutionService: input.storageLogicalAccessResolutionService,
    tokenSecret: imageAssetStorageTokenSecret,
  });
  const imageAssetAuditSink = new AuthoritativeImageAssetAuditSink(input.authoritativeAuditRecorder);

  const imageAssetManagementBackendApi = new ImageAssetManagementBackendApi({
    initiateImageAssetCreationUseCase: new InitiateImageAssetCreationUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      storageInstanceRepository: input.persistentPlatformServices.storageInstanceRepository,
      storagePolicyEvaluationPort: input.workspaceAwareStoragePolicyEvaluationAdapter,
      authorizationPolicyDecisionEvaluator: input.authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    finalizeImageAssetUploadUseCase: new FinalizeImageAssetUploadUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      auditSink: imageAssetAuditSink,
    }),
    getImageAssetMetadataUseCase: new GetImageAssetMetadataUseCase({
      imageAssetRepository,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      authorizationPolicyDecisionEvaluator: input.authorizationDecisionEvaluator,
    }),
    listImageAssetMetadataUseCase: new ListImageAssetMetadataUseCase({
      imageAssetRepository,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      authorizationPolicyDecisionEvaluator: input.authorizationDecisionEvaluator,
    }),
    getImageAssetOriginalContentUseCase: new GetImageAssetOriginalContentUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      authorizationPolicyDecisionEvaluator: input.authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    requestImageAssetPreviewContentUseCase: new RequestImageAssetPreviewContentUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      authorizationPolicyDecisionEvaluator: input.authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    openImageAssetPreviewContentUseCase: new OpenImageAssetPreviewContentUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
      authorizationPolicyDecisionEvaluator: input.authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    imageAssetStoragePort: imageAssetStorageAdapter,
    uploadSessionTokenSecret: imageAssetUploadSessionTokenSecret,
    observability: new ImageAssetManagementObservability({
      logger: input.imageAssetObservabilityLogger,
    }),
  });

  return Object.freeze({
    imageAssetManagementBackendApi,
    dispose: () => {
      imageAssetRepository.dispose();
    },
  });
}
