import type {
  ArtifactBrowseKind,
  ArtifactBrowserLocator,
  ArtifactBrowseSuccessValue,
  ArtifactReadSuccessValue,
} from "../../../contracts/artifact-browser";
import type { ContractBoundaryContext, ContractResult } from "../../../contracts/shared";
import type { StorageObjectMetadata } from "../../../contracts/storage";

export interface BrowseArtifactsRequest extends ContractBoundaryContext {
  artifactKind: ArtifactBrowseKind;
}

export interface ReadArtifactDetailRequest extends ContractBoundaryContext {
  locator: ArtifactBrowserLocator;
}

export interface ArtifactBrowserMetadataReadPort {
  browseArtifacts(
    request: BrowseArtifactsRequest,
  ): Promise<ContractResult<ArtifactBrowseSuccessValue>>;

  readArtifactDetail<TMetadata extends StorageObjectMetadata = StorageObjectMetadata>(
    request: ReadArtifactDetailRequest,
  ): Promise<ContractResult<ArtifactReadSuccessValue<TMetadata>>>;
}
