import type { StorageBackendCapabilitySnapshot } from "../../../application/storage/ports/StorageCapabilityInspectionPort";
import { StorageBackendTypes, StorageReplicationModes, type StorageInstance } from "../../../domain/storage/StorageDomain";

export const StorageSyncDeploymentAvailabilities = Object.freeze({
  active: "active",
  configuredInactive: "configured-inactive",
  unavailable: "unavailable",
});

export type StorageSyncDeploymentAvailability =
  typeof StorageSyncDeploymentAvailabilities[keyof typeof StorageSyncDeploymentAvailabilities];

export const StorageSynchronizationReasonCodes = Object.freeze({
  deploymentUnavailable: "sync-deployment-unavailable",
  deploymentConfiguredInactive: "sync-deployment-configured-inactive",
  backendNotSyncCapable: "sync-backend-not-capable",
  replicationNotConfigured: "sync-replication-not-configured",
  replicationModeUnsupported: "sync-replication-mode-unsupported",
  syncOperational: "sync-operational",
  syncPending: "sync-pending",
});

export type StorageSynchronizationReasonCode =
  typeof StorageSynchronizationReasonCodes[keyof typeof StorageSynchronizationReasonCodes];

export interface StorageSynchronizationEligibilitySnapshot {
  readonly storageInstanceId: string;
  readonly backendType: StorageInstance["backendType"];
  readonly replicationMode: StorageInstance["replication"]["mode"];
  readonly syncCapable: boolean;
  readonly supportsReplicationSyncOperation: boolean;
  readonly deploymentAvailability: StorageSyncDeploymentAvailability;
  readonly evaluatedAt: string;
  readonly reasonCode: StorageSynchronizationReasonCode;
}

export interface StorageSynchronizationStateSnapshot {
  readonly storageInstanceId: string;
  readonly status: "pending" | "healthy" | "degraded" | "disabled";
  readonly deploymentAvailability: StorageSyncDeploymentAvailability;
  readonly syncCapable: boolean;
  readonly supportsReplicationSyncOperation: boolean;
  readonly evaluatedAt: string;
  readonly reasonCode: StorageSynchronizationReasonCode;
}

export interface StorageSynchronizationAssessmentRequest {
  readonly storageInstance: StorageInstance;
  readonly backendCapabilities?: StorageBackendCapabilitySnapshot;
  readonly occurredAt?: string;
}

export interface StorageSynchronizationAdapter {
  assessSynchronizationEligibility(
    input: StorageSynchronizationAssessmentRequest,
  ): StorageSynchronizationEligibilitySnapshot;
  inspectSynchronizationState(
    input: StorageSynchronizationAssessmentRequest,
  ): StorageSynchronizationStateSnapshot;
}

export interface StorageSynchronizationDeploymentProfile {
  readonly availability: StorageSyncDeploymentAvailability;
}

export class ServerManagedStorageSynchronizationAdapter implements StorageSynchronizationAdapter {
  private readonly availability: StorageSyncDeploymentAvailability;

  public constructor(profile: StorageSynchronizationDeploymentProfile) {
    this.availability = profile.availability;
  }

  public assessSynchronizationEligibility(
    input: StorageSynchronizationAssessmentRequest,
  ): StorageSynchronizationEligibilitySnapshot {
    const evaluatedAt = input.occurredAt ?? new Date().toISOString();
    const syncSupport = this.resolveSyncSupport(input.storageInstance, input.backendCapabilities);
    const reasonCode = this.resolveEligibilityReasonCode(
      syncSupport.syncCapable,
      syncSupport.supportsReplicationSyncOperation,
      input.storageInstance,
    );
    return Object.freeze({
      storageInstanceId: input.storageInstance.id,
      backendType: input.storageInstance.backendType,
      replicationMode: input.storageInstance.replication.mode,
      syncCapable: syncSupport.syncCapable,
      supportsReplicationSyncOperation: syncSupport.supportsReplicationSyncOperation,
      deploymentAvailability: this.availability,
      evaluatedAt,
      reasonCode,
    });
  }

  public inspectSynchronizationState(
    input: StorageSynchronizationAssessmentRequest,
  ): StorageSynchronizationStateSnapshot {
    const eligibility = this.assessSynchronizationEligibility(input);
    const status = this.resolveSyncStatus(eligibility);
    return Object.freeze({
      storageInstanceId: eligibility.storageInstanceId,
      status,
      deploymentAvailability: eligibility.deploymentAvailability,
      syncCapable: eligibility.syncCapable,
      supportsReplicationSyncOperation: eligibility.supportsReplicationSyncOperation,
      evaluatedAt: eligibility.evaluatedAt,
      reasonCode: eligibility.reasonCode,
    });
  }

  private resolveSyncSupport(
    storageInstance: StorageInstance,
    backendCapabilities?: StorageBackendCapabilitySnapshot,
  ): { readonly syncCapable: boolean; readonly supportsReplicationSyncOperation: boolean } {
    if (this.availability === StorageSyncDeploymentAvailabilities.unavailable) {
      return Object.freeze({
        syncCapable: false,
        supportsReplicationSyncOperation: false,
      });
    }

    if (storageInstance.backendType === StorageBackendTypes.managedFilesystem) {
      return Object.freeze({
        syncCapable: false,
        supportsReplicationSyncOperation: false,
      });
    }

    if (backendCapabilities) {
      const supportsSync = backendCapabilities.supportsSyncReplication;
      const supportsAsync = backendCapabilities.supportsAsyncReplication;
      const supportsRequestedReplication = storageInstance.replication.mode === StorageReplicationModes.none
        ? supportsSync || supportsAsync
        : storageInstance.replication.mode === StorageReplicationModes.asyncMirror
          ? supportsAsync
          : supportsSync;
      return Object.freeze({
        syncCapable: supportsSync || supportsAsync,
        supportsReplicationSyncOperation: supportsRequestedReplication,
      });
    }

    if (storageInstance.backendType === StorageBackendTypes.networkShare || storageInstance.backendType === StorageBackendTypes.objectStorage) {
      return Object.freeze({
        syncCapable: true,
        supportsReplicationSyncOperation: true,
      });
    }

    return Object.freeze({
      syncCapable: false,
      supportsReplicationSyncOperation: false,
    });
  }

  private resolveEligibilityReasonCode(
    syncCapable: boolean,
    supportsReplicationSyncOperation: boolean,
    storageInstance: StorageInstance,
  ): StorageSynchronizationReasonCode {
    if (this.availability === StorageSyncDeploymentAvailabilities.unavailable) {
      return StorageSynchronizationReasonCodes.deploymentUnavailable;
    }
    if (this.availability === StorageSyncDeploymentAvailabilities.configuredInactive) {
      return StorageSynchronizationReasonCodes.deploymentConfiguredInactive;
    }
    if (!syncCapable) {
      return StorageSynchronizationReasonCodes.backendNotSyncCapable;
    }
    if (storageInstance.replication.mode === StorageReplicationModes.none) {
      return StorageSynchronizationReasonCodes.replicationNotConfigured;
    }
    if (!supportsReplicationSyncOperation) {
      return StorageSynchronizationReasonCodes.replicationModeUnsupported;
    }
    return StorageSynchronizationReasonCodes.syncPending;
  }

  private resolveSyncStatus(eligibility: StorageSynchronizationEligibilitySnapshot): StorageSynchronizationStateSnapshot["status"] {
    if (eligibility.deploymentAvailability !== StorageSyncDeploymentAvailabilities.active) {
      return "disabled";
    }

    if (!eligibility.syncCapable) {
      return "disabled";
    }

    if (!eligibility.supportsReplicationSyncOperation) {
      return "degraded";
    }

    if (eligibility.replicationMode === StorageReplicationModes.none) {
      return "disabled";
    }

    return "pending";
  }
}
