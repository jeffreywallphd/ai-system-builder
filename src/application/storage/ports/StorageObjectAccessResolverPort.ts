import type { StorageBackendType } from "../../../domain/storage/StorageDomain";
import type { IStorageObjectPort } from "./StorageObjectPort";

export interface IStorageObjectAccessResolverPort {
  resolveStorageObjectPort(backendType: StorageBackendType): IStorageObjectPort | undefined;
}
