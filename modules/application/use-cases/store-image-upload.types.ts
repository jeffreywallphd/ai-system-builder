import type {
  RegisterStagedDataResult,
  StagedDataMetadata,
} from "../../contracts/ingestion";
import type { ContractErrorDetails } from "../../contracts/shared";

export interface StoreImageUploadCommand {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface StoreImageUploadCommandContext {
  source: string;
}

export type StoreImageUploadUseCaseResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> = RegisterStagedDataResult<TDetails, TMetadata>;
