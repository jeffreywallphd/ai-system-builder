import {
  createIngestWebsitePageFailureResult,
  createIngestWebsitePageRequest,
  type IngestWebsitePageRequest,
  type IngestWebsitePageResult,
} from "../../contracts/ingestion";
import { createContractError } from "../../contracts/shared";

import type { ApplicationRequestContext } from "../ports";
import type { WebsiteHtmlAcquisitionPort } from "../ports/ingestion";
import {
  mapAcquisitionResultToDomain,
  mapAcquisitionResultToStagedArtifactDescriptor,
  mapDomainCommandToAcquisitionRequest,
  mapDomainResultToContractResult,
  mapIngestWebsitePageRequestToDomain,
} from "./website-ingestion/website-ingestion.mappers";

export interface IngestWebsitePageUseCaseDependencies {
  acquisition: WebsiteHtmlAcquisitionPort;
  now?: () => string;
}

export class IngestWebsitePageUseCase {
  private readonly acquisition: WebsiteHtmlAcquisitionPort;
  private readonly now: () => string;

  public constructor(dependencies: IngestWebsitePageUseCaseDependencies) {
    this.acquisition = dependencies.acquisition;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async execute(
    request: IngestWebsitePageRequest,
    context?: ApplicationRequestContext,
  ): Promise<IngestWebsitePageResult> {
    try {
      const normalizedRequest = createIngestWebsitePageRequest(request);
      const domainCommand = mapIngestWebsitePageRequestToDomain(normalizedRequest);
      const acquisitionRequest = mapDomainCommandToAcquisitionRequest(domainCommand);
      const acquisitionResult = await this.acquisition.acquireWebsiteHtml(acquisitionRequest, context);
      const domainResult = mapAcquisitionResultToDomain(acquisitionResult, domainCommand);
      const stagedArtifact = mapAcquisitionResultToStagedArtifactDescriptor({
        command: domainCommand,
        acquisitionResult,
        retrievedAt: this.now(),
      });

      return mapDomainResultToContractResult({
        ingestion: domainResult,
        stagedArtifact,
      });
    } catch (error) {
      const code = error instanceof Error && error.message.includes("must") ? "validation" : "internal";
      return createIngestWebsitePageFailureResult(
        createContractError(
          code,
          error instanceof Error ? error.message : "Website ingestion failed unexpectedly.",
        ),
      );
    }
  }
}
