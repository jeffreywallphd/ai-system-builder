import type { ContractBoundaryContext } from "../shared";

export interface HasArtifactRequest extends ContractBoundaryContext {
  key: string;
}

export function createHasArtifactRequest(
  key: string,
  options?: ContractBoundaryContext,
): HasArtifactRequest {
  return {
    key,
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  };
}
