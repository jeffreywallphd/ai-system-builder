import {
  createRegisterStagedDataFailureResult,
  createRegisterStagedDataSuccessResult,
  type RegisterStagedDataResult,
  type StagedDataDescriptor,
  type StagedDataMetadata,
} from "../../../contracts/ingestion";
import type {
  ContractBoundaryContext,
  ContractError,
  ContractErrorDetails,
} from "../../../contracts/shared";

export function mapStoreImageUploadToRegisterStagedDataResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  result:
    | {
      ok: true;
      descriptor: StagedDataDescriptor<TMetadata>;
    }
    | {
      ok: false;
      error: ContractError<TDetails>;
    },
  context?: ContractBoundaryContext,
): RegisterStagedDataResult<TDetails, TMetadata> {
  if (result.ok) {
    return createRegisterStagedDataSuccessResult(result.descriptor, context);
  }

  return createRegisterStagedDataFailureResult(result.error, context);
}
