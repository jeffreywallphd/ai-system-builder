import { normalizeArtifactBrowseSuccessValue } from "../../contracts/artifact-browser";
import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../contracts/shared";
import type { ArtifactBrowserMetadataReadPort } from "../ports/artifact-browser";
import type {
  BrowseArtifactsCommand,
  BrowseArtifactsUseCaseResult,
} from "./artifact-browser-read.types";

export interface BrowseArtifactsUseCaseDependencies {
  artifactBrowserMetadataRead: ArtifactBrowserMetadataReadPort;
}

export class BrowseArtifactsUseCase {
  private readonly artifactBrowserMetadataRead: ArtifactBrowserMetadataReadPort;

  public constructor(dependencies: BrowseArtifactsUseCaseDependencies) {
    this.artifactBrowserMetadataRead = dependencies.artifactBrowserMetadataRead;
  }

  public async execute(
    command: BrowseArtifactsCommand,
  ): Promise<BrowseArtifactsUseCaseResult> {
    if (command.artifactKind !== "image") {
      return createFailureResult(
        createContractError(
          "validation",
          `artifactKind must be "image". Received "${String(command.artifactKind)}".`,
        ),
        command,
      );
    }

    try {
      const result = await this.artifactBrowserMetadataRead.browseArtifacts({
        artifactKind: "image",
        requestId: command.requestId,
        correlationId: command.correlationId,
      });

      if (!result.ok) {
        return result;
      }

      return createSuccessResult(normalizeArtifactBrowseSuccessValue(result.value), command);
    } catch (error) {
      return createFailureResult(
        createContractError("internal", "Unexpected artifact browse failure.", {
          details: {
            reason: error instanceof Error ? error.message : String(error),
          },
        }),
        command,
      );
    }
  }
}
