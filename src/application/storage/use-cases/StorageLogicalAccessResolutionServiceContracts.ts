import type { StorageInstance } from "@domain/storage/StorageDomain";
import type { IStorageObjectPort } from "../ports/StorageObjectPort";

export const StorageLogicalAccessOperationIntents = Object.freeze({
  createObjectKey: "create-object-key",
  writeObject: "write-object",
  objectExists: "object-exists",
  readObjectMetadata: "read-object-metadata",
  openObjectReadStream: "open-object-read-stream",
  deleteObject: "delete-object",
});

export type StorageLogicalAccessOperationIntent =
  typeof StorageLogicalAccessOperationIntents[keyof typeof StorageLogicalAccessOperationIntents];

export const StorageLogicalAccessResolutionErrorCodes = Object.freeze({
  invalidRequest: "storage-logical-access-invalid-request",
  notFound: "storage-logical-access-not-found",
  policyViolation: "storage-logical-access-policy-violation",
  capabilityUnsupported: "storage-logical-access-capability-unsupported",
  internal: "storage-logical-access-internal",
});

export type StorageLogicalAccessResolutionErrorCode =
  typeof StorageLogicalAccessResolutionErrorCodes[keyof typeof StorageLogicalAccessResolutionErrorCodes];

export interface ResolveStorageLogicalAccessCommand {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly intent: StorageLogicalAccessOperationIntent;
  readonly storageInstanceRef?: string;
  readonly storageInstanceId?: string;
  readonly occurredAt?: string;
}

export interface StorageLogicalAccessResolutionPlan {
  readonly intent: StorageLogicalAccessOperationIntent;
  readonly storageInstance: StorageInstance;
  readonly objectPort: IStorageObjectPort;
  readonly occurredAt: string;
}

export type StorageLogicalAccessResolutionResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: StorageLogicalAccessResolutionErrorCode;
      readonly message: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };
  };

export interface IStorageLogicalAccessResolutionService {
  resolveLogicalAccessPlan(
    command: ResolveStorageLogicalAccessCommand,
  ): Promise<StorageLogicalAccessResolutionResult<StorageLogicalAccessResolutionPlan>>;
}

