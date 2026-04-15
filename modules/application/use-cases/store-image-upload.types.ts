import type { ContractResult } from "../../contracts/shared";
import type {
  StorageObjectDescriptor,
  StorageObjectMetadata,
} from "../../contracts/storage";

export interface StoreImageUploadCommand {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface StoreImageUploadCommandContext {
  host: "desktop";
  source: string;
}

export interface StoreImageUploadUseCaseSuccessValue<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> {
  descriptor: StorageObjectDescriptor<TMetadata>;
}

export type StoreImageUploadUseCaseResult<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> = ContractResult<StoreImageUploadUseCaseSuccessValue<TMetadata>>;
