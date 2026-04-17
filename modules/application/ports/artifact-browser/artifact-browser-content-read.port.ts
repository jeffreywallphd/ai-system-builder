import type {
  ArtifactBrowserLocator,
  ArtifactContentReadSuccessValue,
} from "../../../contracts/artifact-browser";
import type { ContractBoundaryContext, ContractResult } from "../../../contracts/shared";

export interface ReadArtifactContentRequest extends ContractBoundaryContext {
  locator: ArtifactBrowserLocator;
}

export interface ArtifactBrowserContentReadPort {
  readArtifactContent(
    request: ReadArtifactContentRequest,
  ): Promise<ContractResult<ArtifactContentReadSuccessValue>>;
}
