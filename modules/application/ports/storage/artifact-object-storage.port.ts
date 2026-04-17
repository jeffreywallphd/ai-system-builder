import type {
  DeleteArtifactRequest,
  DeleteArtifactResult,
  HasArtifactRequest,
  HasArtifactResult,
  RetrieveArtifactRequest,
  RetrieveArtifactResult,
  StoreArtifactRequest,
  StoreArtifactResult,
} from "../../../contracts/storage";

/**
 * Application port for the artifact-object storage family (key/blob oriented).
 */
export interface ArtifactObjectStoragePort {
  storeArtifact<TContent = Uint8Array>(
    request: StoreArtifactRequest<TContent>,
  ): Promise<StoreArtifactResult>;

  retrieveArtifact<TContent = Uint8Array>(
    request: RetrieveArtifactRequest,
  ): Promise<RetrieveArtifactResult<TContent>>;

  hasArtifact(request: HasArtifactRequest): Promise<HasArtifactResult>;

  deleteArtifact(request: DeleteArtifactRequest): Promise<DeleteArtifactResult>;
}
