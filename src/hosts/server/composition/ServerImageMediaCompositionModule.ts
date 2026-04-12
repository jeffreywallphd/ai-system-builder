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
import type { ServerComposedSecretService } from "@infrastructure/security/secrets/SecretServiceComposition";
import { ServerPlatformSecretConsumers } from "@infrastructure/security/secrets/ServerPlatformSecretConsumers";

export interface ServerImageMediaCompositionModuleInput {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly secretService: ServerComposedSecretService;
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

export async function composeServerImageMediaCompositionModule(
  input: ServerImageMediaCompositionModuleInput,
): Promise<ServerImageMediaCompositionModuleOutput> {
  const imageAssetRepository = new SqliteImageAssetPersistenceAdapter(input.databasePath);
  const imageAssetStorageTokenSecret = await resolveCriticalServerSecurityMaterial({
    environment: input.env,
    secretService: input.secretService,
    materialId: "material:server:image-asset-storage-token-secret",
    environmentKey: "AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    startupSecurityMaterialValidation: input.startupSecurityMaterialValidation,
    logger: input.imageAssetObservabilityLogger,
    materialFormat: "string-secret",
  });
  await resolveCriticalServerSecurityMaterial({
    environment: input.env,
    secretService: input.secretService,
    materialId: "material:server:image-upload-session-token-secret",
    environmentKey: "AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    startupSecurityMaterialValidation: input.startupSecurityMaterialValidation,
    logger: input.imageAssetObservabilityLogger,
    materialFormat: "string-secret",
  });
  const imageAssetUploadSessionTokenTransitionWindowMs = resolveUploadSessionTokenPreviousVersionValidationWindowMs(
    input.env,
  );
  const runtimeSecurityMaterialResolver = new ServerPlatformSecretConsumers(
    input.secretService.runtimeSecretConsumptionAdapters,
  );
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
    runtimeSecurityMaterialResolver,
    uploadSessionTokenSecretId: "secret:server:image-upload-session-token",
    uploadSessionTokenSigningPurpose: "image-asset-upload-session-token-signing",
    uploadSessionTokenPreviousVersionValidationWindowMs: imageAssetUploadSessionTokenTransitionWindowMs,
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

function resolveUploadSessionTokenPreviousVersionValidationWindowMs(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const parsed = Number.parseInt(
    env.AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_PREVIOUS_VERSION_VALIDATION_WINDOW_MS ?? "",
    10,
  );
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 15 * 60 * 1000;
  }
  return parsed;
}
