import type { ContractBoundaryContext } from "../shared";

export interface RetrieveArtifactRequest extends ContractBoundaryContext {
  key: string;
}

export function createRetrieveArtifactRequest(
  key: string,
  options?: ContractBoundaryContext,
): RetrieveArtifactRequest {
  return {
    key,
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  };
}
