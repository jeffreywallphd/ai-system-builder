import type {
  ArtifactBrowseKind,
  ArtifactBrowserLocator,
  ArtifactBrowseSuccessValue,
  ArtifactReadSuccessValue,
} from "../../../contracts/artifact-browser";
import type { ContractResult } from "../../../contracts/shared";
import type { StorageObjectMetadata } from "../../../contracts/storage";
import type { ArtifactBrowserBoundaryContext } from "./artifact-browser-request-context";

export interface BrowseArtifactsRequest {
  artifactKind: ArtifactBrowseKind;
}

export interface ReadArtifactDetailRequest {
  locator: ArtifactBrowserLocator;
}

export interface ArtifactBrowserMetadataReadPort {
  browseArtifacts(
    request: BrowseArtifactsRequest,
    context?: ArtifactBrowserBoundaryContext,
  ): Promise<ContractResult<ArtifactBrowseSuccessValue>>;

  readArtifactDetail<TMetadata extends StorageObjectMetadata = StorageObjectMetadata>(
    request: ReadArtifactDetailRequest,
    context?: ArtifactBrowserBoundaryContext,
  ): Promise<ContractResult<ArtifactReadSuccessValue<TMetadata>>>;
}
