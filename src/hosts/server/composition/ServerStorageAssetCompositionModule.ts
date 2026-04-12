import path from "node:path";
import type { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { StorageManagementService } from "@application/storage/use-cases/StorageManagementService";
import { StorageLogicalAccessResolutionService } from "@application/storage/use-cases/StorageLogicalAccessResolutionService";
import { AssetUploadInitiationService } from "@application/assets/use-cases/AssetUploadInitiationService";
import { AssetGeneratedOutputRegistrationService } from "@application/assets/use-cases/AssetGeneratedOutputRegistrationService";
import { AssetUploadIngestionService } from "@application/assets/use-cases/AssetUploadIngestionService";
import { AssetDiscoveryService } from "@application/assets/use-cases/AssetDiscoveryService";
import { AssetDetailService } from "@application/assets/use-cases/AssetDetailService";
import { AssetDownloadService } from "@application/assets/use-cases/AssetDownloadService";
import { AssetPreviewService } from "@application/assets/use-cases/AssetPreviewService";
import { AssetLifecycleService } from "@application/assets/use-cases/AssetLifecycleService";
import { EncryptionPolicyEvaluationService } from "@application/security/use-cases/EncryptionPolicyEvaluationService";
import { EncryptionKeyResolutionService } from "@application/security/use-cases/EncryptionKeyResolutionService";
import { FanoutStorageManagementAuditSink, FanoutAssetAuditSink } from "@infrastructure/audit/AuditFanoutPublishers";
import { AuthoritativeStorageManagementAuditSink } from "@infrastructure/audit/AuthoritativeStorageManagementAuditSink";
import { AuthoritativeProtectedAssetAuditSink } from "@infrastructure/audit/AuthoritativeProtectedAssetAuditSink";
import { StorageManagementBackendApi } from "@infrastructure/api/storage/StorageManagementBackendApi";
import { WorkspaceAwareStoragePolicyEvaluationAdapter } from "@infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter";
import { AssetManagementBackendApi } from "@infrastructure/api/assets/AssetManagementBackendApi";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { StorageBackendProvisioningOrchestrator } from "@infrastructure/storage/StorageBackendProvisioningOrchestrator";
import { createStorageBackendAdapterRegistry } from "@infrastructure/storage/StorageBackendAdapterRegistry";
import {
  ServerManagedLocalStorageBackendAdapter,
  ServerManagedLocalStorageObjectAdapter,
} from "@infrastructure/storage/local";
import {
  ServerManagedStorageSynchronizationAdapter,
  StorageSyncDeploymentAvailabilities,
} from "@infrastructure/storage/sync/ServerManagedStorageSynchronizationAdapter";
import { EncryptedAssetDownloadGrantAdapter } from "@infrastructure/security/assets/EncryptedAssetDownloadGrantAdapter";
import { AesGcmAssetContentCipherPort } from "@infrastructure/security/encryption/AesGcmAssetContentCipherPort";
import { VersionedServerScopedAssetContentEncryptionKeyPort } from "@infrastructure/security/encryption/VersionedServerScopedAssetContentEncryptionKeyPort";
import { WorkspaceStorageEncryptionPolicyContextResolver } from "@infrastructure/security/encryption/WorkspaceStorageEncryptionPolicyContextResolver";
import { EncryptionEnforcementObservabilityReporter } from "@infrastructure/security/EncryptionEnforcementObservabilityReporter";
import type { SecurityMaterialStartupValidationResult } from "@application/security/services/SecurityMaterialStartupValidationPipeline";
import { resolveCriticalServerSecurityMaterial } from "./ResolveCriticalServerSecurityMaterial";
import type { ServerComposedSecretService } from "@infrastructure/security/secrets/SecretServiceComposition";
import { ServerPlatformSecretConsumers } from "@infrastructure/security/secrets/ServerPlatformSecretConsumers";

export interface ServerStorageAssetCompositionModuleInput {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly secretService: ServerComposedSecretService;
  readonly startupSecurityMaterialValidation?: SecurityMaterialStartupValidationResult;
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly encryptionObservabilityLogger?: {
    info(event: Readonly<Record<string, unknown>>): void;
    warn(event: Readonly<Record<string, unknown>>): void;
    error(event: Readonly<Record<string, unknown>>): void;
  };
}

export interface ServerStorageAssetCompositionModuleOutput {
  readonly storageManagementBackendApi: StorageManagementBackendApi;
  readonly assetManagementBackendApi: AssetManagementBackendApi;
  readonly storageLogicalAccessResolutionService: StorageLogicalAccessResolutionService;
  readonly workspaceAwareStoragePolicyEvaluationAdapter: WorkspaceAwareStoragePolicyEvaluationAdapter;
  readonly assetEncryptionPolicyEvaluationService: EncryptionPolicyEvaluationService;
}

export async function composeServerStorageAssetCompositionModule(
  input: ServerStorageAssetCompositionModuleInput,
): Promise<ServerStorageAssetCompositionModuleOutput> {
  const storageInstanceRepository = input.persistentPlatformServices.storageInstanceRepository;
  const storageManagementAuditRecorder = input.persistentPlatformServices.storageManagementAuditRecorder;
  const assetRepository = input.persistentPlatformServices.assetRepository;
  const assetAuditRecorder = input.persistentPlatformServices.assetAuditRecorder;
  const assetUploadSessionRepository = input.persistentPlatformServices.assetUploadSessionRepository;
  const workspaceRepository = input.persistentPlatformServices.workspaceRepository;

  const managedStorageRootPath = resolveManagedStorageRootPath(path.resolve(input.databasePath), input.env);
  const localStorageBackendAdapter = new ServerManagedLocalStorageBackendAdapter({
    managedStorageRootPath,
  });
  const localStorageObjectAdapter = new ServerManagedLocalStorageObjectAdapter({
    managedStorageRootPath,
  });
  const storageBackendAdapterRegistry = createStorageBackendAdapterRegistry([{
    backendType: "managed-filesystem",
    provisioningPort: localStorageBackendAdapter,
    capabilityInspectionPort: localStorageBackendAdapter,
    objectPort: localStorageObjectAdapter,
  }]);
  const storageProvisioningOrchestrator = new StorageBackendProvisioningOrchestrator(
    storageBackendAdapterRegistry,
  );
  const storageSynchronizationAdapter = new ServerManagedStorageSynchronizationAdapter({
    availability: resolveStorageSyncDeploymentAvailability(input.env),
  });
  const workspaceAwareStoragePolicyEvaluationAdapter = new WorkspaceAwareStoragePolicyEvaluationAdapter({
    workspaceAuthorizationReadRepository: workspaceRepository,
  });
  const storageManagementService = new StorageManagementService({
    repository: storageInstanceRepository,
    policyPort: workspaceAwareStoragePolicyEvaluationAdapter,
    provisioningPort: storageProvisioningOrchestrator,
    capabilityPort: storageProvisioningOrchestrator,
    auditSink: new FanoutStorageManagementAuditSink([
      storageManagementAuditRecorder,
      new AuthoritativeStorageManagementAuditSink(input.authoritativeAuditRecorder),
    ]),
  });
  const assetAuditSink = new FanoutAssetAuditSink([
    assetAuditRecorder,
    new AuthoritativeProtectedAssetAuditSink(input.authoritativeAuditRecorder),
  ]);
  const storageManagementBackendApi = new StorageManagementBackendApi({
    storageManagementService,
    capabilityInspectionPort: storageProvisioningOrchestrator,
    synchronizationAdapter: storageSynchronizationAdapter,
  });

  const storageLogicalAccessResolutionService = new StorageLogicalAccessResolutionService({
    repository: storageInstanceRepository,
    policyPort: workspaceAwareStoragePolicyEvaluationAdapter,
    objectAccessResolver: storageBackendAdapterRegistry,
  });
  const assetDownloadGrantSecret = await resolveCriticalServerSecurityMaterial({
    environment: input.env,
    secretService: input.secretService,
    materialId: "material:server:asset-download-grant-secret",
    environmentKey: "AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET",
    startupSecurityMaterialValidation: input.startupSecurityMaterialValidation,
    logger: input.encryptionObservabilityLogger,
    materialFormat: "string-secret",
  });
  const assetContentEncryptionKey = await resolveCriticalServerSecurityMaterial({
    environment: input.env,
    secretService: input.secretService,
    materialId: "material:server:asset-content-encryption-key",
    environmentKey: "AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    startupSecurityMaterialValidation: input.startupSecurityMaterialValidation,
    logger: input.encryptionObservabilityLogger,
    materialFormat: "aes256-base64",
  });
  const runtimeSecurityMaterialResolver = new ServerPlatformSecretConsumers(
    input.secretService.runtimeSecretConsumptionAdapters,
  );
  const assetContentKeyPort = new VersionedServerScopedAssetContentEncryptionKeyPort({
    runtimeSecurityMaterialResolver,
    secretId: "secret:server:asset-content-encryption-key",
    fallbackEncodedKey: assetContentEncryptionKey,
    keyPrefix: normalizeOptional(input.env.AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY_PREFIX) ?? "kek:asset-content",
    legacyDeterministicVersionId: "secret:server:asset-content-encryption-key:v1",
  });
  const assetEncryptionPolicyContextResolver = new WorkspaceStorageEncryptionPolicyContextResolver({
    workspaceRepository,
    storageInstanceRepository,
  });
  const encryptionObservabilityReporter = new EncryptionEnforcementObservabilityReporter({
    logger: input.encryptionObservabilityLogger,
  });
  const assetEncryptionPolicyEvaluationService = new EncryptionPolicyEvaluationService({
    encryptionAtRestPolicyContextResolverPort: assetEncryptionPolicyContextResolver,
    observabilityPort: encryptionObservabilityReporter,
  });
  const assetEncryptionKeyResolutionService = new EncryptionKeyResolutionService({
    encryptionPolicyEvaluationService: assetEncryptionPolicyEvaluationService,
    encryptionKeyCatalogPort: assetContentKeyPort,
    observabilityPort: encryptionObservabilityReporter,
  });
  const assetContentCipherPort = new AesGcmAssetContentCipherPort({
    keyMaterialPort: assetContentKeyPort,
  });

  const assetManagementBackendApi = new AssetManagementBackendApi({
    uploadInitiationService: new AssetUploadInitiationService({
      repository: assetRepository,
      uploadSessionRepository: assetUploadSessionRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      storageInstanceRepository,
      storagePolicyEvaluationPort: workspaceAwareStoragePolicyEvaluationAdapter,
      auditSink: assetAuditSink,
    }),
    generatedOutputRegistrationService: new AssetGeneratedOutputRegistrationService({
      repository: assetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      storageInstanceRepository,
      storagePolicyEvaluationPort: workspaceAwareStoragePolicyEvaluationAdapter,
      auditSink: assetAuditSink,
    }),
    uploadIngestionService: new AssetUploadIngestionService({
      repository: assetRepository,
      uploadSessionRepository: assetUploadSessionRepository,
      storageLogicalAccessResolutionService,
      encryptionPolicyEvaluationService: assetEncryptionPolicyEvaluationService,
      encryptionKeyResolutionService: assetEncryptionKeyResolutionService,
      assetContentCipherPort,
      encryptionObservabilityPort: encryptionObservabilityReporter,
      auditSink: assetAuditSink,
    }),
    discoveryService: new AssetDiscoveryService({
      repository: assetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      auditSink: assetAuditSink,
    }),
    detailService: new AssetDetailService({
      repository: assetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      auditSink: assetAuditSink,
    }),
    downloadService: new AssetDownloadService({
      repository: assetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      storageLogicalAccessResolutionService,
      downloadGrantPort: new EncryptedAssetDownloadGrantAdapter({
        secret: assetDownloadGrantSecret,
      }),
      encryptionPolicyEvaluationService: assetEncryptionPolicyEvaluationService,
      assetContentCipherPort,
      encryptionObservabilityPort: encryptionObservabilityReporter,
      auditSink: assetAuditSink,
    }),
    previewService: new AssetPreviewService({
      repository: assetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      auditSink: assetAuditSink,
    }),
    lifecycleService: new AssetLifecycleService({
      repository: assetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      auditSink: assetAuditSink,
    }),
  });

  return Object.freeze({
    storageManagementBackendApi,
    assetManagementBackendApi,
    storageLogicalAccessResolutionService,
    workspaceAwareStoragePolicyEvaluationAdapter,
    assetEncryptionPolicyEvaluationService,
  });
}

function resolveStorageSyncDeploymentAvailability(
  env: Readonly<Record<string, string | undefined>>,
): typeof StorageSyncDeploymentAvailabilities[keyof typeof StorageSyncDeploymentAvailabilities] {
  const configured = env.AI_LOOM_STORAGE_SYNC_DEPLOYMENT_AVAILABILITY?.trim().toLowerCase();
  switch (configured) {
    case StorageSyncDeploymentAvailabilities.active:
      return StorageSyncDeploymentAvailabilities.active;
    case StorageSyncDeploymentAvailabilities.configuredInactive:
      return StorageSyncDeploymentAvailabilities.configuredInactive;
    case StorageSyncDeploymentAvailabilities.unavailable:
      return StorageSyncDeploymentAvailabilities.unavailable;
    default:
      return StorageSyncDeploymentAvailabilities.configuredInactive;
  }
}

function resolveManagedStorageRootPath(
  databasePath: string,
  env: Readonly<Record<string, string | undefined>>,
): string {
  const configured = env.AI_LOOM_STORAGE_MANAGED_ROOT_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(path.dirname(databasePath), "runtime-assets", "managed-storage");
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
