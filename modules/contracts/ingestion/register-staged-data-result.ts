import {
  type ContractBoundaryContext,
  type ContractError,
  type ContractErrorDetails,
  type ContractResult,
  createFailureResult,
  createSuccessResult,
} from "../shared";
import {
  normalizeStagedDataDescriptor,
  type StagedDataDescriptor,
  type StagedDataMetadata,
} from "./staged-data-descriptor";

export type RegisterStagedDataResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> = ContractResult<StagedDataDescriptor<TMetadata>, TDetails>;

export function createRegisterStagedDataSuccessResult<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  descriptor: StagedDataDescriptor<TMetadata>,
  context?: ContractBoundaryContext,
): RegisterStagedDataResult<ContractErrorDetails, TMetadata> {
  return createSuccessResult(normalizeStagedDataDescriptor(descriptor), context);
}

export function createRegisterStagedDataFailureResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
>(
  error: ContractError<TDetails>,
  context?: ContractBoundaryContext,
): RegisterStagedDataResult<TDetails> {
  return createFailureResult(error, context);
}
