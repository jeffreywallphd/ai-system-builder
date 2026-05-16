import { createWebsiteHtmlAcquisitionPort } from "../../../adapters/ingestion";
import { IngestWebsitePageUseCase, IngestWebsitePagesBatchUseCase } from "../../../application/use-cases";

export interface ComposeDesktopIngestionFeatureOptions {
  artifacts: any;
  now?: () => string;
}

export function composeDesktopIngestionFeature(options: ComposeDesktopIngestionFeatureOptions): any {
  let disposed = false;
  const websiteHtmlAcquisition = createWebsiteHtmlAcquisitionPort();
  const ingestWebsitePageUseCase = new IngestWebsitePageUseCase({ acquisition: websiteHtmlAcquisition, storage: options.artifacts.storage, now: options.now });
  return { dispose() { disposed = true; }, get disposed() { return disposed; }, ingestWebsitePageUseCase, ingestWebsitePagesBatchUseCase: new IngestWebsitePagesBatchUseCase({ ingestWebsitePage: ingestWebsitePageUseCase }) };
}
