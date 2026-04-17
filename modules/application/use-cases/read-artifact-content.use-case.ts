import {
  normalizeArtifactBrowserLocator,
  normalizeArtifactContentReadSuccessValue,
} from "../../contracts/artifact-browser";
import {
  createContractError,
  createFailureResult,
  createSuccessResult,
} from "../../contracts/shared";
import type { ArtifactBrowserContentReadPort } from "../ports/artifact-browser";
import type {
  ReadArtifactContentCommand,
  ReadArtifactContentUseCaseResult,
} from "./artifact-browser-read.types";

export interface ReadArtifactContentUseCaseDependencies {
  artifactBrowserContentRead: ArtifactBrowserContentReadPort;
}

export class ReadArtifactContentUseCase {
  private readonly artifactBrowserContentRead: ArtifactBrowserContentReadPort;

  public constructor(dependencies: ReadArtifactContentUseCaseDependencies) {
    this.artifactBrowserContentRead = dependencies.artifactBrowserContentRead;
  }

  public async execute(
    command: ReadArtifactContentCommand,
  ): Promise<ReadArtifactContentUseCaseResult> {
    let locator;

    try {
      locator = normalizeArtifactBrowserLocator(command.locator);
    } catch (error) {
      return createFailureResult(
        createContractError("validation", "locator.storageKey must be a non-empty string.", {
          details: {
            reason: error instanceof Error ? error.message : String(error),
          },
        }),
        command,
      );
    }

    try {
      const result = await this.artifactBrowserContentRead.readArtifactContent({
        locator,
        requestId: command.requestId,
        correlationId: command.correlationId,
      });

      if (!result.ok) {
        return result;
      }

      return createSuccessResult(normalizeArtifactContentReadSuccessValue(result.value), command);
    } catch (error) {
      return createFailureResult(
        createContractError("internal", "Unexpected artifact content read failure.", {
          details: {
            reason: error instanceof Error ? error.message : String(error),
          },
        }),
        command,
      );
    }
  }
}
