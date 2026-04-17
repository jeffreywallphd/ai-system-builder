import type { ContractBoundaryContext } from "../shared";
import {
  normalizeArtifactRepoTarget,
  type ArtifactRepoTarget,
} from "./artifact-repo-target";

export interface HasArtifactInRepoRequest extends ContractBoundaryContext {
  target: ArtifactRepoTarget;
}

export function createHasArtifactInRepoRequest(
  target: ArtifactRepoTarget,
  options?: ContractBoundaryContext,
): HasArtifactInRepoRequest {
  return {
    target: normalizeArtifactRepoTarget(target),
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  };
}
