import {
  StorageManagedActions,
  StoragePolicyRestrictedCapabilities,
  type StorageInstance,
} from "../../../domain/storage/StorageDomain";
import type {
  StorageAccessEffectivePermissionSummary,
  StorageAccessSummarySource,
  StorageInstanceAccessSummary,
  StoragePolicyRestrictedCapabilitySummary,
} from "../../../application/storage/ports/StorageAccessSummaryPort";
import type {
  StorageAccessPermissionEffect,
  StorageAccessSummaryDto,
  StorageAccessSummarySource as StorageAccessSummarySourceDto,
  StorageDisplayMetadataDto,
  StorageInstanceDetailDto,
  StorageInstanceSummaryDto,
  StorageInternalInstanceDetailDto,
  StorageInternalInstanceSummaryDto,
  StoragePolicyMetadataDto,
  StorageReplicationPolicyDto,
  StorageReplicationStatusDto,
  StorageSensitiveMetadataDto,
  StorageSyncStatus,
} from "../../contracts/storage/StorageTransportContracts";
import {
  toStorageInstanceDetailDto,
  toStorageInstanceSummaryDto,
} from "../../contracts/storage/StorageTransportContracts";

export interface CreateStorageInstanceRequestDto {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly storageInstanceId: string;
  readonly backendType: StorageInstance["backendType"];
  readonly display: StorageDisplayMetadataDto;
  readonly ownerUserIdentityId: string;
  readonly access: {
    readonly mode: StorageInstance["access"]["mode"];
    readonly scope: StorageInstance["access"]["scope"];
  };
  readonly replication?: StorageReplicationPolicyDto;
  readonly policy: {
    readonly policyId: string;
    readonly maxObjectBytes?: number;
    readonly retentionDays?: number;
    readonly immutableWrites?: boolean;
    readonly allowCrossWorkspaceReads?: boolean;
    readonly labels?: Readonly<Record<string, string>>;
    readonly encryptionMode?: StorageInstance["policy"]["security"]["encryptionMode"];
    readonly contentEncryptionRequired?: boolean;
    readonly keyScope?: StorageInstance["policy"]["security"]["keyScope"];
    readonly allowPreviewDecryption?: boolean;
    readonly allowWorkerDecryption?: boolean;
    readonly retentionExpiryAction?: StorageInstance["policy"]["lifecycle"]["retentionExpiryAction"];
    readonly purgeGracePeriodDays?: number;
    readonly encryptionProfileId: string;
    readonly encryptionKeyReferenceId?: string;
    readonly envelopeRequired: boolean;
  };
  readonly createdAt?: string;
  readonly lifecycleState?: StorageInstance["lifecycleState"];
}

export interface UpdateStorageInstanceRequestDto {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly storageInstanceId: string;
  readonly display?: Omit<StorageDisplayMetadataDto, "displayName"> & {
    readonly displayName?: string;
  };
  readonly policy?: {
    readonly maxObjectBytes?: number;
    readonly retentionDays?: number;
    readonly immutableWrites?: boolean;
    readonly allowCrossWorkspaceReads?: boolean;
    readonly labels?: Readonly<Record<string, string>>;
    readonly encryptionMode?: StorageInstance["policy"]["security"]["encryptionMode"];
    readonly contentEncryptionRequired?: boolean;
    readonly keyScope?: StorageInstance["policy"]["security"]["keyScope"];
    readonly allowPreviewDecryption?: boolean;
    readonly allowWorkerDecryption?: boolean;
    readonly retentionExpiryAction?: StorageInstance["policy"]["lifecycle"]["retentionExpiryAction"];
    readonly purgeGracePeriodDays?: number;
    readonly encryptionProfileId?: string;
    readonly encryptionKeyReferenceId?: string;
    readonly envelopeRequired?: boolean;
  };
  readonly replication?: StorageReplicationPolicyDto;
  readonly lifecycleState?: StorageInstance["lifecycleState"];
  readonly occurredAt?: string;
}

export interface ListStorageInstancesRequestDto {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly backendTypes?: ReadonlyArray<StorageInstance["backendType"]>;
  readonly lifecycleStates?: ReadonlyArray<StorageInstance["lifecycleState"]>;
  readonly accessModes?: ReadonlyArray<StorageInstance["access"]["mode"]>;
  readonly accessScopes?: ReadonlyArray<StorageInstance["access"]["scope"]>;
  readonly limit?: number;
  readonly offset?: number;
  readonly occurredAt?: string;
}

export interface GetStorageInstanceDetailRequestDto {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly occurredAt?: string;
}

export interface CreateStorageInstanceResponseDto {
  readonly storage: StorageInstanceDetailDto;
}

export interface UpdateStorageInstanceResponseDto {
  readonly storage: StorageInstanceDetailDto;
}

export interface ListStorageInstancesResponseDto {
  readonly items: ReadonlyArray<StorageInstanceSummaryDto>;
}

export interface GetStorageInstanceDetailResponseDto {
  readonly storage: StorageInstanceDetailDto;
}

export interface StorageDtoProjectionOptions {
  readonly description?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly iconName?: string;
  readonly colorToken?: string;
  readonly displayLabels?: Readonly<Record<string, string>>;
  readonly replicationStatus?: {
    readonly lastSyncAt?: string;
    readonly lastSyncStatus?: StorageSyncStatus;
    readonly syncLagSeconds?: number;
  };
  readonly sensitive?: StorageSensitiveMetadataDto;
  readonly accessSummary?: Omit<StorageInstanceAccessSummary, "workspaceId" | "ownerUserIdentityId" | "mode" | "scope"> & {
    readonly effectivePermissions?: ReadonlyArray<StorageAccessEffectivePermissionSummary>;
    readonly policyRestrictedCapabilities?: ReadonlyArray<StoragePolicyRestrictedCapabilitySummary>;
    readonly source?: StorageAccessSummarySource;
  };
}

interface PermissionResolutionSeed {
  readonly effect: StorageAccessPermissionEffect;
  readonly reasonCode?: string;
  readonly message?: string;
}

const DefaultPermissionSeeds = Object.freeze({
  [StorageManagedActions.view]: Object.freeze({ effect: "unknown" as const }),
  [StorageManagedActions.updateMetadata]: Object.freeze({ effect: "unknown" as const }),
  [StorageManagedActions.provision]: Object.freeze({ effect: "unknown" as const }),
  [StorageManagedActions.activate]: Object.freeze({ effect: "unknown" as const }),
  [StorageManagedActions.deactivate]: Object.freeze({ effect: "unknown" as const }),
  [StorageManagedActions.useForAssets]: Object.freeze({ effect: "unknown" as const }),
});

function toStorageAccessSummary(instance: StorageInstance, options?: StorageDtoProjectionOptions): StorageAccessSummaryDto {
  const providedPermissions = options?.accessSummary?.effectivePermissions ?? [];
  const permissionByAction = new Map<StorageAccessEffectivePermissionSummary["action"], PermissionResolutionSeed>();
  for (const permission of providedPermissions) {
    permissionByAction.set(permission.action, {
      effect: permission.effect,
      reasonCode: permission.reasonCode,
      message: permission.message,
    });
  }

  const effectivePermissions = Object.values(StorageManagedActions).map((action) => {
    const resolved = permissionByAction.get(action) ?? DefaultPermissionSeeds[action];
    return Object.freeze({
      action,
      effect: resolved.effect,
      reasonCode: resolved.reasonCode,
      message: resolved.message,
    });
  });
  const allowedActions = effectivePermissions
    .filter((permission) => permission.effect === "allowed")
    .map((permission) => permission.action);

  const providedCapabilities = new Map<StoragePolicyRestrictedCapabilitySummary["capability"], StoragePolicyRestrictedCapabilitySummary>();
  for (const capability of options?.accessSummary?.policyRestrictedCapabilities ?? []) {
    providedCapabilities.set(capability.capability, capability);
  }

  const policyRestrictedCapabilities = Object.freeze([
    Object.freeze(
      providedCapabilities.get(StoragePolicyRestrictedCapabilities.mutableWrites) ?? {
        capability: StoragePolicyRestrictedCapabilities.mutableWrites,
        restricted: instance.policy.immutableWrites,
        reasonCode: instance.policy.immutableWrites ? "immutable-writes-enforced" : undefined,
      },
    ),
    Object.freeze(
      providedCapabilities.get(StoragePolicyRestrictedCapabilities.crossWorkspaceReads) ?? {
        capability: StoragePolicyRestrictedCapabilities.crossWorkspaceReads,
        restricted: !instance.policy.allowCrossWorkspaceReads,
        reasonCode: !instance.policy.allowCrossWorkspaceReads ? "cross-workspace-reads-disabled" : undefined,
      },
    ),
    Object.freeze(
      providedCapabilities.get(StoragePolicyRestrictedCapabilities.previewDecryption) ?? {
        capability: StoragePolicyRestrictedCapabilities.previewDecryption,
        restricted: !instance.policy.security.allowPreviewDecryption,
        reasonCode: !instance.policy.security.allowPreviewDecryption ? "preview-decryption-disabled" : undefined,
      },
    ),
    Object.freeze(
      providedCapabilities.get(StoragePolicyRestrictedCapabilities.workerDecryption) ?? {
        capability: StoragePolicyRestrictedCapabilities.workerDecryption,
        restricted: !instance.policy.security.allowWorkerDecryption,
        reasonCode: !instance.policy.security.allowWorkerDecryption ? "worker-decryption-disabled" : undefined,
      },
    ),
  ]);

  const actorUserIdentityId = options?.accessSummary?.actorUserIdentityId;
  const isOwner = actorUserIdentityId
    ? actorUserIdentityId === instance.ownership.ownerUserIdentityId
    : options?.accessSummary?.isOwner ?? false;
  const source: StorageAccessSummarySourceDto = options?.accessSummary?.source ?? "unknown";

  return Object.freeze({
    workspaceId: instance.ownership.workspaceId,
    ownerUserIdentityId: instance.ownership.ownerUserIdentityId,
    actorUserIdentityId,
    mode: instance.access.mode,
    scope: instance.access.scope,
    isOwner,
    source,
    effectivePermissions,
    allowedActions,
    policyRestrictedCapabilities,
  });
}

function toStoragePolicyMetadata(instance: StorageInstance): StoragePolicyMetadataDto {
  return Object.freeze({
    policyId: instance.policy.policyId,
    maxObjectBytes: instance.policy.maxObjectBytes,
    retentionDays: instance.policy.retentionDays,
    immutableWrites: instance.policy.immutableWrites,
    allowCrossWorkspaceReads: instance.policy.allowCrossWorkspaceReads,
    labels: instance.policy.labels,
    encryptionMode: instance.policy.security.encryptionMode,
    contentEncryptionRequired: instance.policy.security.contentEncryptionRequired,
    keyScope: instance.policy.security.keyScope,
    allowPreviewDecryption: instance.policy.security.allowPreviewDecryption,
    allowWorkerDecryption: instance.policy.security.allowWorkerDecryption,
    retentionExpiryAction: instance.policy.lifecycle.retentionExpiryAction,
    purgeGracePeriodDays: instance.policy.lifecycle.purgeGracePeriodDays,
    encryptionProfileId: instance.policy.encryption.profileId,
    envelopeRequired: instance.policy.encryption.envelopeRequired,
    hasEncryptionKeyReference: Boolean(instance.policy.encryption.keyReferenceId),
  });
}

function toStorageReplicationStatus(
  instance: StorageInstance,
  options?: StorageDtoProjectionOptions,
): StorageReplicationStatusDto {
  return Object.freeze({
    mode: instance.replication.mode,
    replicaStorageInstanceId: instance.replication.replicaStorageInstanceId,
    syncIntervalSeconds: instance.replication.syncIntervalSeconds,
    lastSyncAt: options?.replicationStatus?.lastSyncAt,
    lastSyncStatus: options?.replicationStatus?.lastSyncStatus ?? "pending",
    syncLagSeconds: options?.replicationStatus?.syncLagSeconds,
  });
}

function toStorageDisplayMetadata(
  instance: StorageInstance,
  options?: StorageDtoProjectionOptions,
): StorageDisplayMetadataDto {
  return Object.freeze({
    displayName: instance.displayName,
    description: options?.description,
    tags: options?.tags,
    labels: options?.displayLabels,
    iconName: options?.iconName,
    colorToken: options?.colorToken,
  });
}

export function toStorageInternalInstanceSummaryDto(
  instance: StorageInstance,
  options?: StorageDtoProjectionOptions,
): StorageInternalInstanceSummaryDto {
  return Object.freeze({
    storageInstanceId: instance.id,
    workspaceId: instance.ownership.workspaceId,
    backendType: instance.backendType,
    display: toStorageDisplayMetadata(instance, options),
    lifecycle: Object.freeze({
      state: instance.lifecycleState,
      createdAt: instance.createdAt,
      lastModifiedAt: instance.lastModifiedAt,
      lastCorrelationId: instance.lastCorrelationId,
    }),
  });
}

export function toStorageInternalInstanceDetailDto(
  instance: StorageInstance,
  options?: StorageDtoProjectionOptions,
): StorageInternalInstanceDetailDto {
  return Object.freeze({
    ...toStorageInternalInstanceSummaryDto(instance, options),
    ownerUserIdentityId: instance.ownership.ownerUserIdentityId,
    access: toStorageAccessSummary(instance, options),
    policy: toStoragePolicyMetadata(instance),
    replication: toStorageReplicationStatus(instance, options),
    sensitive: options?.sensitive,
  });
}

export function toCreateStorageInstanceResponseDto(
  instance: StorageInstance,
  options?: StorageDtoProjectionOptions,
): CreateStorageInstanceResponseDto {
  return Object.freeze({
    storage: toStorageInstanceDetailDto(toStorageInternalInstanceDetailDto(instance, options)),
  });
}

export function toUpdateStorageInstanceResponseDto(
  instance: StorageInstance,
  options?: StorageDtoProjectionOptions,
): UpdateStorageInstanceResponseDto {
  return Object.freeze({
    storage: toStorageInstanceDetailDto(toStorageInternalInstanceDetailDto(instance, options)),
  });
}

export function toListStorageInstancesResponseDto(
  items: ReadonlyArray<StorageInstance>,
  optionsByStorageId?: Readonly<Record<string, StorageDtoProjectionOptions>>,
): ListStorageInstancesResponseDto {
  return Object.freeze({
    items: items.map((item) => toStorageInstanceSummaryDto(
      toStorageInternalInstanceSummaryDto(item, optionsByStorageId?.[item.id]),
    )),
  });
}

export function toGetStorageInstanceDetailResponseDto(
  instance: StorageInstance,
  options?: StorageDtoProjectionOptions,
): GetStorageInstanceDetailResponseDto {
  return Object.freeze({
    storage: toStorageInstanceDetailDto(toStorageInternalInstanceDetailDto(instance, options)),
  });
}
