import {
  createIngestWebsitePageSuccessResult,
  normalizeWebsiteHtmlAcquisitionRequest,
  normalizeWebsiteHtmlAcquisitionResult,
  normalizeStagedArtifactDescriptor,
  type IngestWebsitePageRequest,
  type IngestWebsitePageResult,
  type StagedArtifactDescriptor,
  type WebsiteHtmlAcquisitionRequest,
  type WebsiteHtmlAcquisitionResult,
} from "../../../contracts/ingestion";
import { type ArtifactFamily } from "../../../domain/artifact";
import {
  normalizeWebsiteHtmlCaptureMetadata,
  normalizeWebsiteIngestionMode,
  normalizeWebsiteIngestionTarget,
  type WebsiteHtmlCaptureMetadata,
  type WebsiteIngestionMode,
  type WebsiteIngestionResult,
  type WebsiteIngestionTarget,
} from "../../../domain/website-ingestion";

export interface WebsitePageIngestionCommand {
  target: WebsiteIngestionTarget;
  mode: WebsiteIngestionMode;
}

export interface WebsitePageIngestionCompleted {
  ingestion: WebsiteIngestionResult;
  stagedArtifact: StagedArtifactDescriptor<WebsiteHtmlCaptureMetadata & { artifactFamily: ArtifactFamily }>;
}

export function mapIngestWebsitePageRequestToDomain(
  request: IngestWebsitePageRequest,
): WebsitePageIngestionCommand {
  return {
    target: normalizeWebsiteIngestionTarget({
      url: request.url,
      label: request.label,
    }),
    mode: normalizeWebsiteIngestionMode(request.mode ?? "automatic"),
  };
}

export function mapDomainCommandToAcquisitionRequest(
  command: WebsitePageIngestionCommand,
): WebsiteHtmlAcquisitionRequest {
  return normalizeWebsiteHtmlAcquisitionRequest({
    sourceKind: "scrape",
    target: {
      url: command.target.url,
      label: command.target.label,
    },
    mode: command.mode,
  });
}

export function mapAcquisitionResultToDomain(
  acquisitionResult: WebsiteHtmlAcquisitionResult,
  command: WebsitePageIngestionCommand,
): WebsiteIngestionResult {
  const normalized = normalizeWebsiteHtmlAcquisitionResult(acquisitionResult);

  return {
    target: command.target,
    resolvedUrl: normalized.resolvedUrl,
    retrievalModeUsed: normalized.retrievalModeUsed,
  };
}

function toStorageKey(resolvedUrl: string, retrievedAt: string): string {
  const url = new URL(resolvedUrl);
  const host = url.hostname.toLowerCase();
  const path = url.pathname === "/" ? "index" : url.pathname;
  const pathToken = path.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "index";
  const timestampToken = retrievedAt.replace(/[:.]/g, "-");
  return `staged/website/${host}/${pathToken}-${timestampToken}.html`;
}

export function mapAcquisitionResultToStagedArtifactDescriptor(input: {
  command: WebsitePageIngestionCommand;
  acquisitionResult: WebsiteHtmlAcquisitionResult;
  retrievedAt: string;
}): StagedArtifactDescriptor<WebsiteHtmlCaptureMetadata & { artifactFamily: ArtifactFamily }> {
  const normalizedAcquisition = normalizeWebsiteHtmlAcquisitionResult(input.acquisitionResult);
  const metadata = normalizeWebsiteHtmlCaptureMetadata({
    sourceUrl: input.command.target.url,
    resolvedUrl: normalizedAcquisition.resolvedUrl,
    retrievedAt: input.retrievedAt,
    retrievalModeUsed: normalizedAcquisition.retrievalModeUsed,
    rendered: normalizedAcquisition.retrievalModeUsed === "rendered",
    httpStatus: normalizedAcquisition.httpStatus,
    contentTypeHeader: normalizedAcquisition.contentTypeHeader,
  });

  const artifactFamily: ArtifactFamily = "structured-text";

  return normalizeStagedArtifactDescriptor({
    sourceKind: "scrape",
    originalName: `${new URL(normalizedAcquisition.resolvedUrl).hostname}.html`,
    metadata: {
      ...metadata,
      artifactFamily,
    },
    storage: {
      key: toStorageKey(normalizedAcquisition.resolvedUrl, input.retrievedAt),
      mediaType: "text/html",
      sizeBytes: Buffer.byteLength(normalizedAcquisition.html, "utf8"),
    },
  });
}

export function mapDomainResultToContractResult(
  completed: WebsitePageIngestionCompleted,
): IngestWebsitePageResult {
  return createIngestWebsitePageSuccessResult({
    sourceKind: "scrape",
    target: {
      url: completed.ingestion.target.url,
      label: completed.ingestion.target.label,
    },
    resolvedUrl: completed.ingestion.resolvedUrl,
    retrievalModeUsed: completed.ingestion.retrievalModeUsed,
    stagedArtifact: completed.stagedArtifact,
    warnings: completed.ingestion.warnings,
  });
}
