import type { ContractResult } from "../../../contracts/shared";
import type { ArtifactBrowserBoundaryContext } from "../artifact-browser";

export interface RetrieveArtifactContentByStorageKeyRequest {
  storageKey: string;
}

export interface ArtifactContentRetrievalValue {
  storageKey: string;
  mediaType?: string;
  sizeBytes?: number;
  bytes: Uint8Array;
}

export interface ArtifactContentRetrievalPort {
  retrieveArtifactContentByStorageKey(
    request: RetrieveArtifactContentByStorageKeyRequest,
    context?: ArtifactBrowserBoundaryContext,
  ): Promise<ContractResult<ArtifactContentRetrievalValue>>;
}
