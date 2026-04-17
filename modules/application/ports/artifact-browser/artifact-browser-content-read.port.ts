import type {
  ArtifactBrowserLocator,
  ArtifactContentReadSuccessValue,
} from "../../../contracts/artifact-browser";
import type { ContractResult } from "../../../contracts/shared";
import type { ArtifactBrowserBoundaryContext } from "./artifact-browser-request-context";

export interface ReadArtifactContentRequest {
  locator: ArtifactBrowserLocator;
}

export interface ArtifactBrowserContentReadPort {
  readArtifactContent(
    request: ReadArtifactContentRequest,
    context?: ArtifactBrowserBoundaryContext,
  ): Promise<ContractResult<ArtifactContentReadSuccessValue>>;
}
