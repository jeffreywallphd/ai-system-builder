import { StorageManagementErrorCodes, type StorageManagementErrorCode } from "./StorageManagementServiceContracts";

export class StorageManagementServiceError extends Error {
  public readonly code: StorageManagementErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: StorageManagementErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StorageManagementServiceError";
    this.code = code;
    this.details = details;
  }
}

export class StoragePolicyViolationError extends StorageManagementServiceError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(StorageManagementErrorCodes.policyViolation, message, details, options);
    this.name = "StoragePolicyViolationError";
  }
}

export class StorageInstanceNotFoundError extends StorageManagementServiceError {
  public constructor(
    storageInstanceId: string,
    workspaceId: string,
    options?: ErrorOptions,
  ) {
    super(
      StorageManagementErrorCodes.notFound,
      `Storage instance '${storageInstanceId}' was not found in workspace '${workspaceId}'.`,
      Object.freeze({ storageInstanceId, workspaceId }),
      options,
    );
    this.name = "StorageInstanceNotFoundError";
  }
}

export class StorageBackendOperationUnsupportedError extends StorageManagementServiceError {
  public constructor(
    operation: string,
    backendType: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(
      StorageManagementErrorCodes.capabilityUnsupported,
      `Storage backend '${backendType}' does not support operation '${operation}'.`,
      Object.freeze({ operation, backendType, ...details }),
      options,
    );
    this.name = "StorageBackendOperationUnsupportedError";
  }
}

export class StorageInvalidLifecycleTransitionError extends StorageManagementServiceError {
  public constructor(
    storageInstanceId: string,
    fromState: string,
    toState: string,
    options?: ErrorOptions,
  ) {
    super(
      StorageManagementErrorCodes.invalidState,
      `Storage instance '${storageInstanceId}' cannot transition from '${fromState}' to '${toState}'.`,
      Object.freeze({ storageInstanceId, fromState, toState }),
      options,
    );
    this.name = "StorageInvalidLifecycleTransitionError";
  }
}
