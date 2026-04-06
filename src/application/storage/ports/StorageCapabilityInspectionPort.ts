import type {
  StorageBackendType,
  StorageInstance,
  StorageReplicationMode,
} from "../../../domain/storage/StorageDomain";

export const StorageBackendHealthStatuses = Object.freeze({
  healthy: "healthy",
  unhealthy: "unhealthy",
  inactive: "inactive",
  unsupported: "unsupported",
} as const);

export type StorageBackendHealthStatus =
  typeof StorageBackendHealthStatuses[keyof typeof StorageBackendHealthStatuses];

export interface StorageBackendHealthSnapshot {
  readonly status: StorageBackendHealthStatus;
  readonly reasonCode: string;
  readonly checkedAt: string;
  readonly notes?: ReadonlyArray<string>;
}

export interface StorageBackendCapabilitySnapshot {
  readonly backendType: StorageBackendType;
  readonly supportsManagedLifecycle: boolean;
  readonly supportsAsyncReplication: boolean;
  readonly supportsSyncReplication: boolean;
  readonly supportsReadOnlyActive: boolean;
  readonly supportsCrossWorkspaceReads: boolean;
  readonly maxObjectBytesLimit?: number;
  readonly minReplicationSyncIntervalSeconds?: number;
  readonly notes?: ReadonlyArray<string>;
  readonly health?: StorageBackendHealthSnapshot;
}

export interface StorageCapabilityInspectionRequest {
  readonly backendType: StorageBackendType;
  readonly workspaceId: string;
  readonly requestedReplicationMode?: StorageReplicationMode;
  readonly occurredAt?: string;
}

export interface StorageInstanceCapabilityInspectionRequest {
  readonly storageInstance: StorageInstance;
  readonly occurredAt?: string;
}

export interface IStorageCapabilityInspectionPort {
  inspectStorageBackendCapabilities(
    input: StorageCapabilityInspectionRequest,
  ): Promise<StorageBackendCapabilitySnapshot>;
  inspectStorageInstanceCapabilities?(
    input: StorageInstanceCapabilityInspectionRequest,
  ): Promise<StorageBackendCapabilitySnapshot>;
}
