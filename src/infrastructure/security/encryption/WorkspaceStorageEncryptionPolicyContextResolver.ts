import type {
  IEncryptionAtRestPolicyContextResolverPort,
  ResolveEncryptionAtRestPolicyContextRequest,
  ResolvedEncryptionAtRestPolicyContext,
} from "@application/security/ports/EncryptionAtRestPolicyEvaluationPorts";
import type { IStorageInstanceRepository } from "@application/storage/ports/IStorageInstanceRepository";
import type { IWorkspaceRepository } from "@application/workspaces/ports/IWorkspaceRepository";
import {
  createEncryptionAtRestPolicyDefinition,
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
  type EncryptionAtRestPolicyDefinition,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  StorageEncryptionKeyScopes,
  StorageEncryptionModes,
  type StorageEncryptionKeyScope,
  type StorageEncryptionMode,
} from "@domain/storage/StorageDomain";
import {
  WorkspaceEncryptionKeyScopes,
  WorkspaceEncryptionModes,
  type WorkspaceEncryptionKeyScope,
  type WorkspaceEncryptionMode,
} from "@domain/workspaces/WorkspaceDomain";

export interface WorkspaceStorageEncryptionPolicyContextResolverDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly storageInstanceRepository: IStorageInstanceRepository;
  readonly platformPolicyId?: string;
}

export class WorkspaceStorageEncryptionPolicyContextResolver implements IEncryptionAtRestPolicyContextResolverPort {
  private readonly platformPolicy: EncryptionAtRestPolicyDefinition;

  public constructor(private readonly dependencies: WorkspaceStorageEncryptionPolicyContextResolverDependencies) {
    this.platformPolicy = createPlatformPolicy(dependencies.platformPolicyId);
  }

  public async resolvePolicyContext(
    request: ResolveEncryptionAtRestPolicyContextRequest,
  ): Promise<ResolvedEncryptionAtRestPolicyContext> {
    const workspaceId = normalizeOptional(request.workspaceId);
    const storageInstanceId = normalizeOptional(request.storageInstanceId);

    const workspace = workspaceId
      ? await this.dependencies.workspaceRepository.findWorkspaceById(workspaceId)
      : undefined;
    const storageInstance = storageInstanceId
      ? await this.dependencies.storageInstanceRepository.findStorageInstanceById(storageInstanceId)
      : undefined;

    if (storageInstance && workspaceId && storageInstance.ownership.workspaceId !== workspaceId) {
      throw new Error("Storage instance workspace does not match encryption policy workspace scope.");
    }

    const resolvedWorkspaceId = workspace?.id ?? storageInstance?.ownership.workspaceId;

    return Object.freeze({
      platformPolicy: this.platformPolicy,
      workspacePolicy: workspace
        ? createEncryptionAtRestPolicyDefinition({
          policyId: `policy:workspace:${workspace.id}:encryption-at-rest`,
          scope: EncryptionPolicyScopes.workspace,
          workspaceId: workspace.id,
          rules: [toAssetContentRuleFromWorkspace(workspace.encryptionPolicy)],
        })
        : undefined,
      storageInstancePolicy: storageInstance
        ? createEncryptionAtRestPolicyDefinition({
          policyId: `policy:storage:${storageInstance.id}:encryption-at-rest`,
          scope: EncryptionPolicyScopes.storageInstance,
          workspaceId: resolvedWorkspaceId,
          storageInstanceId: storageInstance.id,
          rules: [toAssetContentRuleFromStorage(storageInstance.policy.security)],
        })
        : undefined,
    });
  }
}

function createPlatformPolicy(policyId = "policy:platform:encryption-at-rest"): EncryptionAtRestPolicyDefinition {
  return createEncryptionAtRestPolicyDefinition({
    policyId,
    scope: EncryptionPolicyScopes.platform,
    rules: Object.freeze([
      Object.freeze({
        dataClass: ProtectedDataClasses.secretMaterial,
        encryptionMode: EncryptionModes.scopedContent,
        keyScope: EncryptionKeyScopes.server,
        decryption: Object.freeze({
          allowPreview: false,
          allowWorker: false,
        }),
      }),
      Object.freeze({
        dataClass: ProtectedDataClasses.secretMetadata,
        encryptionMode: EncryptionModes.metadataOnly,
        keyScope: EncryptionKeyScopes.server,
        decryption: Object.freeze({
          allowPreview: false,
          allowWorker: false,
        }),
      }),
      Object.freeze({
        dataClass: ProtectedDataClasses.sensitiveMetadata,
        encryptionMode: EncryptionModes.metadataOnly,
        keyScope: EncryptionKeyScopes.server,
        decryption: Object.freeze({
          allowPreview: false,
          allowWorker: false,
        }),
      }),
    ]),
  });
}

function toAssetContentRuleFromWorkspace(policy: {
  readonly encryptionMode: WorkspaceEncryptionMode;
  readonly contentEncryptionRequired: boolean;
  readonly keyScope: WorkspaceEncryptionKeyScope;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}) {
  const encryptionMode = toDomainEncryptionMode(policy.encryptionMode, policy.contentEncryptionRequired);

  return Object.freeze({
    dataClass: ProtectedDataClasses.assetContent,
    encryptionMode,
    keyScope: encryptionMode === EncryptionModes.scopedContent ? toDomainKeyScope(policy.keyScope) : undefined,
    decryption: Object.freeze({
      allowPreview: policy.allowPreviewDecryption,
      allowWorker: policy.allowWorkerDecryption,
    }),
  });
}

function toAssetContentRuleFromStorage(policy: {
  readonly encryptionMode: StorageEncryptionMode;
  readonly contentEncryptionRequired: boolean;
  readonly keyScope: StorageEncryptionKeyScope;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}) {
  const encryptionMode = toDomainEncryptionMode(policy.encryptionMode, policy.contentEncryptionRequired);

  return Object.freeze({
    dataClass: ProtectedDataClasses.assetContent,
    encryptionMode,
    keyScope: encryptionMode === EncryptionModes.scopedContent ? toDomainKeyScope(policy.keyScope) : undefined,
    decryption: Object.freeze({
      allowPreview: policy.allowPreviewDecryption,
      allowWorker: policy.allowWorkerDecryption,
    }),
  });
}

function toDomainEncryptionMode(
  mode: WorkspaceEncryptionMode | StorageEncryptionMode,
  contentEncryptionRequired: boolean,
) {
  if (!contentEncryptionRequired || mode === WorkspaceEncryptionModes.none || mode === StorageEncryptionModes.none) {
    return EncryptionModes.none;
  }
  return EncryptionModes.scopedContent;
}

function toDomainKeyScope(
  keyScope: WorkspaceEncryptionKeyScope | StorageEncryptionKeyScope,
) {
  if (keyScope === WorkspaceEncryptionKeyScopes.platform || keyScope === StorageEncryptionKeyScopes.platform) {
    return EncryptionKeyScopes.server;
  }
  if (keyScope === WorkspaceEncryptionKeyScopes.workspace || keyScope === StorageEncryptionKeyScopes.workspace) {
    return EncryptionKeyScopes.workspace;
  }
  return EncryptionKeyScopes.storageInstance;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

