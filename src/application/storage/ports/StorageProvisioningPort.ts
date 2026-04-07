import type { StorageInstance } from "@domain/storage/StorageDomain";

export const StorageProvisioningOperationKinds = Object.freeze({
  create: "create",
  activate: "activate",
  deactivate: "deactivate",
  replicationSync: "replication-sync",
});

export type StorageProvisioningOperationKind =
  typeof StorageProvisioningOperationKinds[keyof typeof StorageProvisioningOperationKinds];

export const StorageProvisioningOperationStatuses = Object.freeze({
  accepted: "accepted",
  alreadyApplied: "already-applied",
  rejected: "rejected",
});

export type StorageProvisioningOperationStatus =
  typeof StorageProvisioningOperationStatuses[keyof typeof StorageProvisioningOperationStatuses];

export interface StorageProvisioningRequest {
  readonly operationKind: StorageProvisioningOperationKind;
  readonly storageInstance: StorageInstance;
  readonly actorUserIdentityId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface StorageProvisioningReceipt {
  readonly status: StorageProvisioningOperationStatus;
  readonly accepted: boolean;
  readonly backendRequestId?: string;
  readonly occurredAt: string;
  readonly reasonCode?: string;
  readonly message?: string;
}

export interface IStorageProvisioningPort {
  requestStorageProvisioning(input: StorageProvisioningRequest): Promise<StorageProvisioningReceipt>;
}

