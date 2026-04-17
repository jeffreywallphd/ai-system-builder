import type { ContractBoundaryContext } from "../shared";
import {
  normalizeArtifactRepoTarget,
  type ArtifactRepoTarget,
} from "./artifact-repo-target";

export interface RetrieveArtifactFromRepoRequest extends ContractBoundaryContext {
  target: ArtifactRepoTarget;
}

export function createRetrieveArtifactFromRepoRequest(
  target: ArtifactRepoTarget,
  options?: ContractBoundaryContext,
): RetrieveArtifactFromRepoRequest {
  return {
    target: normalizeArtifactRepoTarget(target),
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  };
}
