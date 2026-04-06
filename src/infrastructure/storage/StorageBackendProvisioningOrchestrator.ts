import type {
  IStorageCapabilityInspectionPort,
  StorageBackendCapabilitySnapshot,
  StorageCapabilityInspectionRequest,
  StorageInstanceCapabilityInspectionRequest,
} from "../../application/storage/ports/StorageCapabilityInspectionPort";
import { StorageBackendHealthStatuses } from "../../application/storage/ports/StorageCapabilityInspectionPort";
import {
  StorageProvisioningOperationStatuses,
  type IStorageProvisioningPort,
  type StorageProvisioningReceipt,
  type StorageProvisioningRequest,
} from "../../application/storage/ports/StorageProvisioningPort";
import type { StorageBackendType } from "../../domain/storage/StorageDomain";
import { StorageBackendAdapterRegistry } from "./StorageBackendAdapterRegistry";

export const StorageProvisioningOrchestrationReasonCodes = Object.freeze({
  backendNotConfigured: "storage-backend-not-configured",
  backendOperationFailed: "storage-backend-operation-failed",
  capabilityInspectionUnavailable: "storage-capability-inspection-unavailable",
});

export type StorageProvisioningOrchestrationReasonCode =
  typeof StorageProvisioningOrchestrationReasonCodes[keyof typeof StorageProvisioningOrchestrationReasonCodes];

export class StorageBackendProvisioningOrchestrator implements IStorageProvisioningPort, IStorageCapabilityInspectionPort {
  public constructor(
    private readonly registry: StorageBackendAdapterRegistry,
  ) {}

  public async requestStorageProvisioning(input: StorageProvisioningRequest): Promise<StorageProvisioningReceipt> {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const provisioningPort = this.registry.getProvisioningPort(input.storageInstance.backendType);
    if (!provisioningPort) {
      return this.rejectedReceipt(
        occurredAt,
        StorageProvisioningOrchestrationReasonCodes.backendNotConfigured,
        `No storage provisioning adapter is configured for backend '${input.storageInstance.backendType}'.`,
      );
    }

    try {
      const receipt = await provisioningPort.requestStorageProvisioning(input);
      return Object.freeze({
        ...receipt,
        occurredAt: receipt.occurredAt || occurredAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown backend provisioning failure.";
      return this.rejectedReceipt(
        occurredAt,
        StorageProvisioningOrchestrationReasonCodes.backendOperationFailed,
        `Storage provisioning orchestration failed: ${message}`,
      );
    }
  }

  public async inspectStorageBackendCapabilities(
    input: StorageCapabilityInspectionRequest,
  ): Promise<StorageBackendCapabilitySnapshot> {
    const capabilityPort = this.resolveCapabilityPort(input.backendType);
    if (!capabilityPort) {
      return this.unavailableCapabilities(
        input.backendType,
        `backend-unconfigured:${input.backendType}`,
      );
    }

    try {
      return await capabilityPort.inspectStorageBackendCapabilities(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown capability inspection failure";
      return this.unavailableCapabilities(
        input.backendType,
        `capability-inspection-failed:${message}`,
      );
    }
  }

  public async inspectStorageInstanceCapabilities(
    input: StorageInstanceCapabilityInspectionRequest,
  ): Promise<StorageBackendCapabilitySnapshot> {
    const capabilityPort = this.resolveCapabilityPort(input.storageInstance.backendType);
    if (!capabilityPort) {
      return this.unavailableCapabilities(
        input.storageInstance.backendType,
        `backend-unconfigured:${input.storageInstance.backendType}`,
      );
    }

    if (capabilityPort.inspectStorageInstanceCapabilities) {
      try {
        return await capabilityPort.inspectStorageInstanceCapabilities(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown instance capability inspection failure";
        return this.unavailableCapabilities(
          input.storageInstance.backendType,
          `instance-capability-inspection-failed:${message}`,
        );
      }
    }

    return capabilityPort.inspectStorageBackendCapabilities({
      backendType: input.storageInstance.backendType,
      workspaceId: input.storageInstance.ownership.workspaceId,
      requestedReplicationMode: input.storageInstance.replication.mode,
      occurredAt: input.occurredAt,
    });
  }

  private resolveCapabilityPort(backendType: StorageBackendType): IStorageCapabilityInspectionPort | undefined {
    const explicit = this.registry.getCapabilityInspectionPort(backendType);
    if (explicit) {
      return explicit;
    }

    const provisioningPort = this.registry.getProvisioningPort(backendType);
    if (!provisioningPort || !this.isCapabilityInspectionPort(provisioningPort)) {
      return undefined;
    }

    return provisioningPort;
  }

  private isCapabilityInspectionPort(port: IStorageProvisioningPort): port is IStorageCapabilityInspectionPort {
    const candidate = port as Partial<IStorageCapabilityInspectionPort>;
    return typeof candidate.inspectStorageBackendCapabilities === "function";
  }

  private unavailableCapabilities(backendType: StorageBackendType, note: string): StorageBackendCapabilitySnapshot {
    const checkedAt = new Date().toISOString();
    return Object.freeze({
      backendType,
      supportsManagedLifecycle: false,
      supportsAsyncReplication: false,
      supportsSyncReplication: false,
      supportsReadOnlyActive: false,
      supportsCrossWorkspaceReads: false,
      notes: Object.freeze([
        `${StorageProvisioningOrchestrationReasonCodes.capabilityInspectionUnavailable}:${note}`,
      ]),
      health: Object.freeze({
        status: StorageBackendHealthStatuses.unsupported,
        reasonCode: StorageProvisioningOrchestrationReasonCodes.capabilityInspectionUnavailable,
        checkedAt,
      }),
    });
  }

  private rejectedReceipt(
    occurredAt: string,
    reasonCode: StorageProvisioningOrchestrationReasonCode,
    message: string,
  ): StorageProvisioningReceipt {
    return Object.freeze({
      status: StorageProvisioningOperationStatuses.rejected,
      accepted: false,
      occurredAt,
      reasonCode,
      message,
    });
  }
}
