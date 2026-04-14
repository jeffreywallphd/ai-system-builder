import type { ContractBoundaryContext } from "../shared";

export interface DeleteArtifactRequest extends ContractBoundaryContext {
  key: string;
}

export function createDeleteArtifactRequest(
  key: string,
  options?: ContractBoundaryContext,
): DeleteArtifactRequest {
  return {
    key,
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  };
}
