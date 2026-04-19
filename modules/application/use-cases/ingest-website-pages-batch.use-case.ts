import {
  createIngestWebsitePagesBatchFailureResult,
  createIngestWebsitePagesBatchRequest,
  createIngestWebsitePagesBatchSuccessResult,
  type IngestWebsitePageRequest,
  type IngestWebsitePagesBatchRequest,
  type IngestWebsitePagesBatchResult,
  type IngestWebsitePageSuccessValue,
} from "../../contracts/ingestion";
import { createContractError } from "../../contracts/shared";

import type { ApplicationRequestContext } from "../ports";
import { IngestWebsitePageUseCase } from "./ingest-website-page.use-case";

export interface IngestWebsitePagesBatchUseCaseDependencies {
  ingestWebsitePage: IngestWebsitePageUseCase;
}

export class IngestWebsitePagesBatchUseCase {
  private readonly ingestWebsitePage: IngestWebsitePageUseCase;

  public constructor(dependencies: IngestWebsitePagesBatchUseCaseDependencies) {
    this.ingestWebsitePage = dependencies.ingestWebsitePage;
  }

  public async execute(
    request: IngestWebsitePagesBatchRequest,
    context?: ApplicationRequestContext,
  ): Promise<IngestWebsitePagesBatchResult> {
    try {
      const normalizedRequest = createIngestWebsitePagesBatchRequest(request);
      const items: IngestWebsitePageSuccessValue[] = [];
      let failed = 0;

      for (const target of normalizedRequest.targets) {
        const pageRequest: IngestWebsitePageRequest = {
          url: target.url,
          label: target.label,
          mode: normalizedRequest.mode,
        };

        const result = await this.ingestWebsitePage.execute(pageRequest, context);
        if (result.ok) {
          items.push(result.value);
          continue;
        }

        failed += 1;
      }

      return createIngestWebsitePagesBatchSuccessResult({
        items,
        summary: {
          attempted: normalizedRequest.targets.length,
          succeeded: items.length,
          failed,
        },
      });
    } catch (error) {
      return createIngestWebsitePagesBatchFailureResult(
        createContractError(
          "validation",
          error instanceof Error ? error.message : "Batch website ingestion request was invalid.",
        ),
      );
    }
  }
}
