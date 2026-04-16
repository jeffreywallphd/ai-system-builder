import type { ContractResult } from "../../contracts/shared";
import type {
  StagedDataDescriptor,
  StagedDataMetadata,
} from "../../contracts/ingestion";

export interface StoreImageUploadCommand {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface StoreImageUploadCommandContext {
  source: string;
}

export interface StoreImageUploadUseCaseSuccessValue<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> {
  descriptor: StagedDataDescriptor<TMetadata>;
}

export type StoreImageUploadUseCaseResult<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> = ContractResult<StoreImageUploadUseCaseSuccessValue<TMetadata>>;
