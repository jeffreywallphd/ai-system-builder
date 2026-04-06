import type {
  StorageAccessMode,
  StorageAccessScope,
  StorageBackendType,
  StorageInstance,
  StorageLifecycleState,
} from "../../../domain/storage/StorageDomain";

export interface StorageInstanceListQuery {
  readonly workspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly storageInstanceIds?: ReadonlyArray<string>;
  readonly backendTypes?: ReadonlyArray<StorageBackendType>;
  readonly lifecycleStates?: ReadonlyArray<StorageLifecycleState>;
  readonly accessModes?: ReadonlyArray<StorageAccessMode>;
  readonly accessScopes?: ReadonlyArray<StorageAccessScope>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface StorageInstanceMutationContext {
  readonly operationKey: string;
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
}

export interface StorageInstanceMutationResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

export interface IStorageInstanceRepository {
  findStorageInstanceById(storageInstanceId: string): Promise<StorageInstance | undefined>;
  listStorageInstances(query: StorageInstanceListQuery): Promise<ReadonlyArray<StorageInstance>>;
  createStorageInstance(
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }>;
  saveStorageInstance(
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }>;
}
