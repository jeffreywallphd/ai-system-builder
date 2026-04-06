import type {
  StorageAccessMode,
  StorageAccessScope,
  StorageBackendType,
  StorageInstance,
  StorageLifecycleState,
  StorageReplicationMode,
} from "../../../domain/storage/StorageDomain";
import type { StorageBackendCapabilitySnapshot } from "../ports/StorageCapabilityInspectionPort";
import type { StorageInstanceAccessSummary } from "../ports/StorageAccessSummaryPort";
import type { StorageProvisioningReceipt } from "../ports/StorageProvisioningPort";

export const StorageManagementErrorCodes = Object.freeze({
  invalidRequest: "storage-invalid-request",
  accessDenied: "storage-access-denied",
  notFound: "storage-not-found",
  conflict: "storage-conflict",
  invalidState: "storage-invalid-state",
  policyViolation: "storage-policy-violation",
  capabilityUnsupported: "storage-capability-unsupported",
  provisioningFailed: "storage-provisioning-failed",
  internal: "storage-internal",
});

export type StorageManagementErrorCode =
  typeof StorageManagementErrorCodes[keyof typeof StorageManagementErrorCodes];

export interface StorageManagementError {
  readonly code: StorageManagementErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type StorageManagementResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: StorageManagementError;
  };

export interface CreateStorageInstanceCommand {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey: string;
  readonly correlationId: string;
  readonly storageInstanceId: string;
  readonly displayName: string;
  readonly backendType: StorageBackendType;
  readonly ownerUserIdentityId: string;
  readonly access: {
    readonly mode: StorageAccessMode;
    readonly scope: StorageAccessScope;
  };
  readonly replication?: {
    readonly mode?: StorageReplicationMode;
    readonly replicaStorageInstanceId?: string;
    readonly syncIntervalSeconds?: number;
  };
  readonly policy: {
    readonly policyId: string;
    readonly maxObjectBytes?: number;
    readonly retentionDays?: number;
    readonly immutableWrites?: boolean;
    readonly allowCrossWorkspaceReads?: boolean;
    readonly labels?: Readonly<Record<string, string>>;
    readonly encryption: {
      readonly profileId: string;
      readonly keyReferenceId?: string;
      readonly envelopeRequired: boolean;
    };
  };
  readonly lifecycleState?: StorageLifecycleState;
  readonly createdAt?: string;
  readonly requestBackendProvisioning?: boolean;
  readonly includeCapabilities?: boolean;
}

export interface CreateStorageInstanceResult {
  readonly storageInstance: StorageInstance;
  readonly accessSummary?: StorageInstanceAccessSummary;
  readonly provisioning?: StorageProvisioningReceipt;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
}

export interface UpdateStorageMetadataCommand {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey: string;
  readonly correlationId: string;
  readonly storageInstanceId: string;
  readonly displayName?: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly occurredAt?: string;
  readonly includeCapabilities?: boolean;
}

export interface UpdateStorageMetadataResult {
  readonly storageInstance: StorageInstance;
  readonly accessSummary?: StorageInstanceAccessSummary;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
}

export interface ActivateStorageInstanceCommand {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey: string;
  readonly correlationId: string;
  readonly storageInstanceId: string;
  readonly activatedAt?: string;
  readonly requestBackendActivation?: boolean;
  readonly includeCapabilities?: boolean;
}

export interface DeactivateStorageInstanceCommand {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey: string;
  readonly correlationId: string;
  readonly storageInstanceId: string;
  readonly targetLifecycleState?: Extract<StorageLifecycleState, "suspended" | "archived">;
  readonly deactivatedAt?: string;
  readonly requestBackendDeactivation?: boolean;
  readonly includeCapabilities?: boolean;
}

export interface StorageLifecycleMutationResult {
  readonly storageInstance: StorageInstance;
  readonly accessSummary?: StorageInstanceAccessSummary;
  readonly provisioning?: StorageProvisioningReceipt;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
}

export interface ListAccessibleStorageInstancesQuery {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly backendTypes?: ReadonlyArray<StorageBackendType>;
  readonly lifecycleStates?: ReadonlyArray<StorageLifecycleState>;
  readonly accessModes?: ReadonlyArray<StorageAccessMode>;
  readonly accessScopes?: ReadonlyArray<StorageAccessScope>;
  readonly limit?: number;
  readonly offset?: number;
  readonly includeCapabilities?: boolean;
  readonly occurredAt?: string;
}

export interface AccessibleStorageInstanceItem {
  readonly storageInstance: StorageInstance;
  readonly accessSummary?: StorageInstanceAccessSummary;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
}

export interface ListAccessibleStorageInstancesResult {
  readonly items: ReadonlyArray<AccessibleStorageInstanceItem>;
}

export interface GetStorageInstanceDetailsQuery {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly includeCapabilities?: boolean;
  readonly occurredAt?: string;
}

export interface GetStorageInstanceDetailsResult {
  readonly storageInstance: StorageInstance;
  readonly accessSummary?: StorageInstanceAccessSummary;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
}

export interface IStorageManagementService {
  createStorageInstance(
    command: CreateStorageInstanceCommand,
  ): Promise<StorageManagementResult<CreateStorageInstanceResult>>;
  updateStorageMetadata(
    command: UpdateStorageMetadataCommand,
  ): Promise<StorageManagementResult<UpdateStorageMetadataResult>>;
  activateStorageInstance(
    command: ActivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>>;
  deactivateStorageInstance(
    command: DeactivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>>;
  listAccessibleStorageInstances(
    query: ListAccessibleStorageInstancesQuery,
  ): Promise<StorageManagementResult<ListAccessibleStorageInstancesResult>>;
  getStorageInstanceDetails(
    query: GetStorageInstanceDetailsQuery,
  ): Promise<StorageManagementResult<GetStorageInstanceDetailsResult>>;
}

export interface StorageManagementMutationUseCaseContracts {
  createStorageInstance(
    command: CreateStorageInstanceCommand,
  ): Promise<StorageManagementResult<CreateStorageInstanceResult>>;
  updateStorageMetadata(
    command: UpdateStorageMetadataCommand,
  ): Promise<StorageManagementResult<UpdateStorageMetadataResult>>;
  activateStorageInstance(
    command: ActivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>>;
  deactivateStorageInstance(
    command: DeactivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>>;
}

export interface StorageManagementReadUseCaseContracts {
  listAccessibleStorageInstances(
    query: ListAccessibleStorageInstancesQuery,
  ): Promise<StorageManagementResult<ListAccessibleStorageInstancesResult>>;
  getStorageInstanceDetails(
    query: GetStorageInstanceDetailsQuery,
  ): Promise<StorageManagementResult<GetStorageInstanceDetailsResult>>;
}
