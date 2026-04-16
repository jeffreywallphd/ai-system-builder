import {
  type ContractBoundaryContext,
  type ContractError,
  type ContractErrorDetails,
  type ContractResult,
  createFailureResult,
  createSuccessResult,
} from "../shared";
import {
  normalizeStagedArtifactDescriptor,
  type StagedArtifactDescriptor,
  type StagedArtifactMetadata,
} from "./staged-artifact-descriptor";

export type RegisterStagedArtifactResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TMetadata extends StagedArtifactMetadata = StagedArtifactMetadata,
> = ContractResult<StagedArtifactDescriptor<TMetadata>, TDetails>;

export function createRegisterStagedArtifactSuccessResult<
  TMetadata extends StagedArtifactMetadata = StagedArtifactMetadata,
>(
  descriptor: StagedArtifactDescriptor<TMetadata>,
  context?: ContractBoundaryContext,
): RegisterStagedArtifactResult<ContractErrorDetails, TMetadata> {
  return createSuccessResult(normalizeStagedArtifactDescriptor(descriptor), context);
}

export function createRegisterStagedArtifactFailureResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
>(
  error: ContractError<TDetails>,
  context?: ContractBoundaryContext,
): RegisterStagedArtifactResult<TDetails> {
  return createFailureResult(error, context);
}
