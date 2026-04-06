import type { StorageBackendCapabilitySnapshot } from "../../../../src/application/storage/ports/StorageCapabilityInspectionPort";
import type { StorageProvisioningReceipt } from "../../../../src/application/storage/ports/StorageProvisioningPort";
import type {
  CreateStorageInstanceRequestDto,
  CreateStorageInstanceResponseDto,
  GetStorageInstanceDetailRequestDto,
  GetStorageInstanceDetailResponseDto,
  ListStorageInstancesRequestDto,
  ListStorageInstancesResponseDto,
  UpdateStorageInstanceRequestDto,
  UpdateStorageInstanceResponseDto,
} from "../../../../src/shared/dto/storage/StorageTransportDtos";
import type { StorageSyncStatus, StorageSynchronizationMetadataDto } from "../../../../src/shared/contracts/storage/StorageTransportContracts";

export const StorageManagementApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  invalidState: "invalid-state",
  capabilityUnsupported: "capability-unsupported",
  provisioningFailed: "provisioning-failed",
  internal: "internal",
} as const);

export type StorageManagementApiErrorCode =
  typeof StorageManagementApiErrorCodes[keyof typeof StorageManagementApiErrorCodes];

export interface StorageManagementApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface StorageManagementApiError {
  readonly code: StorageManagementApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<StorageManagementApiValidationError>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface StorageManagementApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: StorageManagementApiError;
}

export interface CreateStorageInstanceApiRequest extends CreateStorageInstanceRequestDto {
  readonly requestBackendProvisioning?: boolean;
  readonly includeCapabilities?: boolean;
}

export interface CreateStorageInstanceApiResponse extends CreateStorageInstanceResponseDto {
  readonly provisioning?: StorageProvisioningReceipt;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
  readonly synchronization?: StorageSynchronizationMetadataDto;
  readonly synchronizationStatus?: StorageSyncStatus;
}

export interface UpdateStorageInstanceMetadataApiRequest extends UpdateStorageInstanceRequestDto {
  readonly includeCapabilities?: boolean;
}

export interface UpdateStorageInstanceMetadataApiResponse extends UpdateStorageInstanceResponseDto {
  readonly capabilities?: StorageBackendCapabilitySnapshot;
  readonly synchronization?: StorageSynchronizationMetadataDto;
  readonly synchronizationStatus?: StorageSyncStatus;
}

export interface ActivateStorageInstanceApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly activatedAt?: string;
  readonly requestBackendActivation?: boolean;
  readonly includeCapabilities?: boolean;
}

export interface ActivateStorageInstanceApiResponse extends GetStorageInstanceDetailResponseDto {
  readonly provisioning?: StorageProvisioningReceipt;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
  readonly synchronization?: StorageSynchronizationMetadataDto;
  readonly synchronizationStatus?: StorageSyncStatus;
}

export interface DeactivateStorageInstanceApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly targetLifecycleState?: "suspended" | "archived";
  readonly deactivatedAt?: string;
  readonly requestBackendDeactivation?: boolean;
  readonly includeCapabilities?: boolean;
}

export interface DeactivateStorageInstanceApiResponse extends GetStorageInstanceDetailResponseDto {
  readonly provisioning?: StorageProvisioningReceipt;
  readonly capabilities?: StorageBackendCapabilitySnapshot;
  readonly synchronization?: StorageSynchronizationMetadataDto;
  readonly synchronizationStatus?: StorageSyncStatus;
}

export interface ListStorageInstancesApiRequest extends ListStorageInstancesRequestDto {
  readonly includeCapabilities?: boolean;
}

export type ListStorageInstancesApiResponse = ListStorageInstancesResponseDto;

export interface GetStorageInstanceDetailApiRequest extends GetStorageInstanceDetailRequestDto {
  readonly includeCapabilities?: boolean;
}

export interface GetStorageInstanceDetailApiResponse extends GetStorageInstanceDetailResponseDto {
  readonly capabilities?: StorageBackendCapabilitySnapshot;
  readonly synchronization?: StorageSynchronizationMetadataDto;
  readonly synchronizationStatus?: StorageSyncStatus;
}

export interface GetStorageInstanceHealthApiRequest extends GetStorageInstanceDetailRequestDto {}

export interface GetStorageInstanceHealthApiResponse {
  readonly storage: GetStorageInstanceDetailResponseDto["storage"];
  readonly capabilities?: StorageBackendCapabilitySnapshot;
  readonly synchronization: StorageSynchronizationMetadataDto;
  readonly synchronizationStatus: StorageSyncStatus;
}
