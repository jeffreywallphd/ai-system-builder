import type {
  StorageAccessMode,
  StorageAccessScope,
  StorageBackendType,
  StorageEncryptionKeyScope,
  StorageEncryptionMode,
  StorageLifecycleState,
  StorageManagedAction,
  StoragePolicyRestrictedCapability,
  StorageReplicationMode,
  StorageRetentionExpiryAction,
} from "../../../domain/storage/StorageDomain";

export class StorageTransportContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageTransportContractError";
  }
}

export const StorageTransportScopes = Object.freeze({
  admin: "admin",
  internal: "internal",
});

export type StorageTransportScope = typeof StorageTransportScopes[keyof typeof StorageTransportScopes];

export const StorageTransportContractVersions = Object.freeze({
  v1: "storage-transport/v1",
});

export type StorageTransportContractVersion =
  typeof StorageTransportContractVersions[keyof typeof StorageTransportContractVersions];

export const StorageTransportFieldLimits = Object.freeze({
  identifierMaxLength: 127,
  displayNameMaxLength: 120,
  descriptionMaxLength: 2000,
  tagMaxLength: 64,
  maxTags: 32,
  labelKeyMaxLength: 64,
  labelValueMaxLength: 256,
  operationKeyMaxLength: 255,
});

export const StorageTransportPatterns = Object.freeze({
  identifier: /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,126}$/,
  storageInstanceId: /^[a-z0-9][a-z0-9-]{2,126}$/,
  metadataLabelKey: /^[a-z][a-z0-9._-]{0,63}$/,
});

export const StorageSyncStatuses = Object.freeze({
  pending: "pending",
  running: "running",
  healthy: "healthy",
  degraded: "degraded",
  failed: "failed",
  disabled: "disabled",
});

export type StorageSyncStatus = typeof StorageSyncStatuses[keyof typeof StorageSyncStatuses];

export const StorageSensitiveRedactionReasons = Object.freeze({
  securitySensitive: "security-sensitive",
  infrastructureInternal: "infrastructure-internal",
});

export type StorageSensitiveRedactionReason =
  typeof StorageSensitiveRedactionReasons[keyof typeof StorageSensitiveRedactionReasons];

export interface StorageDisplayMetadataDto {
  readonly displayName: string;
  readonly description?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly labels?: Readonly<Record<string, string>>;
  readonly iconName?: string;
  readonly colorToken?: string;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface StoragePolicyMetadataDto {
  readonly policyId: string;
  readonly maxObjectBytes?: number;
  readonly retentionDays?: number;
  readonly immutableWrites: boolean;
  readonly allowCrossWorkspaceReads: boolean;
  readonly labels: Readonly<Record<string, string>>;
  readonly encryptionMode: StorageEncryptionMode;
  readonly contentEncryptionRequired: boolean;
  readonly keyScope: StorageEncryptionKeyScope;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
  readonly retentionExpiryAction: StorageRetentionExpiryAction;
  readonly purgeGracePeriodDays?: number;
  readonly encryptionProfileId: string;
  readonly envelopeRequired: boolean;
  readonly hasEncryptionKeyReference: boolean;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface StorageAccessPolicyDto {
  readonly mode: StorageAccessMode;
  readonly scope: StorageAccessScope;
}

export const StorageAccessPermissionEffects = Object.freeze({
  allowed: "allowed",
  denied: "denied",
  restricted: "restricted",
  unknown: "unknown",
});

export type StorageAccessPermissionEffect =
  typeof StorageAccessPermissionEffects[keyof typeof StorageAccessPermissionEffects];

export const StorageAccessSummarySources = Object.freeze({
  authorizationPolicy: "authorization-policy",
  ownershipDefault: "ownership-default",
  mixed: "mixed",
  unknown: "unknown",
});

export type StorageAccessSummarySource =
  typeof StorageAccessSummarySources[keyof typeof StorageAccessSummarySources];

export interface StorageAccessEffectivePermissionDto {
  readonly action: StorageManagedAction;
  readonly effect: StorageAccessPermissionEffect;
  readonly reasonCode?: string;
  readonly message?: string;
}

export interface StoragePolicyRestrictedCapabilityDto {
  readonly capability: StoragePolicyRestrictedCapability;
  readonly restricted: boolean;
  readonly reasonCode?: string;
}

export interface StorageAccessSummaryDto {
  readonly workspaceId: string;
  readonly ownerUserIdentityId: string;
  readonly actorUserIdentityId?: string;
  readonly mode: StorageAccessMode;
  readonly scope: StorageAccessScope;
  readonly isOwner: boolean;
  readonly source: StorageAccessSummarySource;
  readonly effectivePermissions: ReadonlyArray<StorageAccessEffectivePermissionDto>;
  readonly allowedActions: ReadonlyArray<StorageManagedAction>;
  readonly policyRestrictedCapabilities: ReadonlyArray<StoragePolicyRestrictedCapabilityDto>;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface StorageLifecycleMetadataDto {
  readonly state: StorageLifecycleState;
  readonly createdAt: string;
  readonly lastModifiedAt: string;
  readonly lastCorrelationId?: string;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface StorageReplicationPolicyDto {
  readonly mode: StorageReplicationMode;
  readonly replicaStorageInstanceId?: string;
  readonly syncIntervalSeconds?: number;
}

export interface StorageReplicationStatusDto extends StorageReplicationPolicyDto {
  readonly lastSyncAt?: string;
  readonly lastSyncStatus: StorageSyncStatus;
  readonly syncLagSeconds?: number;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface StorageSensitiveMetadataDto {
  readonly backendCredentialReferenceId?: string;
  readonly backendEndpointReferenceId?: string;
  readonly replicationCredentialReferenceId?: string;
  readonly encryptionKeyReferenceId?: string;
  readonly infrastructureBindingReferenceId?: string;
  readonly providerConfigurationReferenceId?: string;
}

export interface StorageSensitiveRedactionEntryDto {
  readonly field: string;
  readonly reason: StorageSensitiveRedactionReason;
  readonly strategy: "omitted";
}

export interface StorageSensitiveRedactionSummaryDto {
  readonly contractVersion: StorageTransportContractVersion;
  readonly redactedFields: ReadonlyArray<StorageSensitiveRedactionEntryDto>;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface StorageInternalInstanceSummaryDto {
  readonly storageInstanceId: string;
  readonly workspaceId: string;
  readonly backendType: StorageBackendType;
  readonly display: StorageDisplayMetadataDto;
  readonly lifecycle: StorageLifecycleMetadataDto;
}

export interface StorageInstanceSummaryDto extends StorageInternalInstanceSummaryDto {}

export interface StorageInternalInstanceDetailDto extends StorageInternalInstanceSummaryDto {
  readonly ownerUserIdentityId: string;
  readonly access: StorageAccessSummaryDto;
  readonly policy: StoragePolicyMetadataDto;
  readonly replication: StorageReplicationStatusDto;
  readonly sensitive?: StorageSensitiveMetadataDto;
}

export interface StorageInstanceDetailDto extends StorageInternalInstanceSummaryDto {
  readonly ownerUserIdentityId: string;
  readonly access: StorageAccessSummaryDto;
  readonly policy: StoragePolicyMetadataDto;
  readonly replication: StorageReplicationStatusDto;
  readonly sensitiveRedaction?: StorageSensitiveRedactionSummaryDto;
}

const InfrastructureSensitiveFieldNames = new Set<string>([
  "backendEndpointReferenceId",
  "infrastructureBindingReferenceId",
  "providerConfigurationReferenceId",
]);

function toStorageSensitiveRedactionSummary(
  sensitive: StorageSensitiveMetadataDto | undefined,
): StorageSensitiveRedactionSummaryDto | undefined {
  if (!sensitive) {
    return undefined;
  }

  const redactedFields = Object.entries(sensitive)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([field]) => Object.freeze({
      field,
      reason: InfrastructureSensitiveFieldNames.has(field)
        ? StorageSensitiveRedactionReasons.infrastructureInternal
        : StorageSensitiveRedactionReasons.securitySensitive,
      strategy: "omitted" as const,
    }));

  if (redactedFields.length < 1) {
    return undefined;
  }

  return Object.freeze({
    contractVersion: StorageTransportContractVersions.v1,
    redactedFields,
  });
}

export function toStorageInstanceSummaryDto(value: StorageInternalInstanceSummaryDto): StorageInstanceSummaryDto {
  return Object.freeze({
    storageInstanceId: value.storageInstanceId,
    workspaceId: value.workspaceId,
    backendType: value.backendType,
    display: value.display,
    lifecycle: value.lifecycle,
  });
}

export function toStorageInstanceDetailDto(value: StorageInternalInstanceDetailDto): StorageInstanceDetailDto {
  if (!value.storageInstanceId.trim()) {
    throw new StorageTransportContractError("Storage detail projection requires storageInstanceId.");
  }

  const sensitiveRedaction = toStorageSensitiveRedactionSummary(value.sensitive);
  return Object.freeze({
    ...toStorageInstanceSummaryDto(value),
    ownerUserIdentityId: value.ownerUserIdentityId,
    access: value.access,
    policy: value.policy,
    replication: value.replication,
    sensitiveRedaction,
  });
}
