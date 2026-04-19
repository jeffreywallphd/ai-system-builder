import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, testDouble } from "../../../testing/node-test";

import type { IngestWebsitePageRequest, WebsiteHtmlAcquisitionRequest } from "../../../contracts/ingestion";
import type { WebsiteHtmlAcquisitionPort } from "../../ports/ingestion";
import { IngestWebsitePageUseCase } from "../ingest-website-page.use-case";
import { IngestWebsitePagesBatchUseCase } from "../ingest-website-pages-batch.use-case";
import {
  mapAcquisitionResultToStagedArtifactDescriptor,
  mapDomainCommandToAcquisitionRequest,
  mapDomainResultToContractResult,
  mapIngestWebsitePageRequestToDomain,
  toStagedArtifactDescriptor,
} from "../website-ingestion/website-ingestion.mappers";

describe("website ingestion use cases", () => {
  it("orchestrates single-page ingestion through request mapping, acquisition, and staged artifact mapping", async () => {
    const acquireWebsiteHtml = testDouble
      .fn<WebsiteHtmlAcquisitionPort["acquireWebsiteHtml"]>()
      .mockResolvedValue({
        sourceKind: "scrape",
        resolvedUrl: "https://example.com/docs",
        html: "<html><body>hello</body></html>",
        mediaType: "text/html",
        retrievalModeUsed: "automatic",
        httpStatus: 200,
        contentTypeHeader: "text/html; charset=utf-8",
      });

    const useCase = new IngestWebsitePageUseCase({
      acquisition: { acquireWebsiteHtml },
      now: () => "2026-04-19T12:00:00.000Z",
    });

    const result = await useCase.execute({
      url: " https://example.com/docs ",
      mode: " automatic ",
    });

    expect(acquireWebsiteHtml).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.sourceKind).toBe("scrape");
    expect(result.value.stagedArtifact?.sourceKind).toBe("scrape");
    expect(result.value.stagedArtifact?.storage.mediaType).toBe("text/html");
    expect(result.value.stagedArtifact?.metadata).toMatchObject({
      artifactFamily: "structured-text",
      sourceUrl: "https://example.com/docs",
      resolvedUrl: "https://example.com/docs",
      retrievedAt: "2026-04-19T12:00:00.000Z",
      retrievalModeUsed: "automatic",
      rendered: false,
    });
  });

  it("returns per-item batch results and continues on partial failures", async () => {
    const singlePage = new IngestWebsitePageUseCase({
      acquisition: {
        acquireWebsiteHtml: async (request) => {
          if (request.target.url.includes("fail")) {
            throw new Error("forced failure");
          }

          return {
            sourceKind: "scrape",
            resolvedUrl: request.target.url,
            html: `<html><body><main>${request.target.url}</main></body></html>`,
            mediaType: "text/html",
            retrievalModeUsed: request.mode,
          };
        },
      },
      now: () => "2026-04-19T13:00:00.000Z",
    });

    const batchUseCase = new IngestWebsitePagesBatchUseCase({ ingestWebsitePage: singlePage });

    const result = await batchUseCase.execute({
      targets: [
        { url: " https://example.com/a " },
        { url: " https://example.com/fail " },
      ],
      mode: " automatic ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.summary).toEqual({
      attempted: 2,
      succeeded: 1,
      failed: 1,
    });
    expect(result.value.items.length).toBe(2);
    expect(result.value.items[0].result.ok).toBe(true);
    expect(result.value.items[1].result.ok).toBe(false);
  });

  it("maps contract requests into domain commands and domain results back to contracts", () => {
    const request: IngestWebsitePageRequest = {
      url: " https://example.com/path ",
      label: " Docs ",
      mode: " rendered ",
    };

    const domainCommand = mapIngestWebsitePageRequestToDomain(request);
    expect(domainCommand).toEqual({
      target: {
        url: "https://example.com/path",
        label: "Docs",
      },
      mode: "rendered",
    });

    const acquisitionRequest: WebsiteHtmlAcquisitionRequest = mapDomainCommandToAcquisitionRequest(domainCommand);
    expect(acquisitionRequest).toMatchObject({
      sourceKind: "scrape",
      target: { url: "https://example.com/path", label: "Docs" },
      mode: "rendered",
    });

    const stagedArtifact = mapAcquisitionResultToStagedArtifactDescriptor({
      command: domainCommand,
      acquisitionResult: {
        sourceKind: "scrape",
        resolvedUrl: "https://example.com/path",
        html: "<html>ok</html>",
        mediaType: "text/html",
        retrievalModeUsed: "rendered",
        httpStatus: 200,
        contentTypeHeader: "text/html",
      },
      retrievedAt: "2026-04-19T14:00:00.000Z",
    });

    const contractResult = mapDomainResultToContractResult({
      ingestion: {
        target: domainCommand.target,
        resolvedUrl: "https://example.com/path",
        retrievalModeUsed: "rendered",
      },
      stagedArtifact,
    });

    expect(contractResult.ok).toBe(true);
    if (!contractResult.ok) {
      return;
    }

    expect(contractResult.value.stagedArtifact?.storage.key).toContain("staged/website/example.com/path-");
    expect(contractResult.value.stagedArtifact?.storage.mediaType).toBe("text/html");
    expect(contractResult.value.stagedArtifact?.metadata).toMatchObject({ artifactFamily: "structured-text" });
    expect(contractResult.value.sourceKind).toBe("scrape");
  });

  it("provides a single staged artifact helper with structured-text family", () => {
    const descriptor = toStagedArtifactDescriptor({
      sourceUrl: "https://example.com/source",
      acquisitionResult: {
        sourceKind: "scrape",
        resolvedUrl: "https://example.com/source",
        html: "<html><body><p>x</p></body></html>",
        mediaType: "text/html",
        retrievalModeUsed: "automatic",
      },
      retrievedAt: "2026-04-19T15:00:00.000Z",
    });

    expect(descriptor.metadata?.artifactFamily).toBe("structured-text");
    expect(descriptor.storage.mediaType).toBe("text/html");
  });

  it("keeps ingestion use case dependent on ingestion port only", () => {
    const source = readFileSync(
      resolve("modules/application/use-cases/ingest-website-page.use-case.ts"),
      "utf8",
    );

    expect(source).toContain('import type { WebsiteHtmlAcquisitionPort } from "../ports/ingestion";');
    expect(source.includes("adapters/ingestion")).toBe(false);
    expect(source.includes("playwright")).toBe(false);
  });
});
