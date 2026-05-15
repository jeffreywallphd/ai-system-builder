import { createWebsiteHtmlAcquisitionPort } from "../../../adapters/ingestion";
import { IngestWebsitePageUseCase, IngestWebsitePagesBatchUseCase } from "../../../application/use-cases";

export interface ComposeDesktopIngestionFeatureOptions {
  artifacts: any;
  now?: () => string;
}

export function composeDesktopIngestionFeature(options: ComposeDesktopIngestionFeatureOptions): any {
  const websiteHtmlAcquisition = createWebsiteHtmlAcquisitionPort();
  const ingestWebsitePageUseCase = new IngestWebsitePageUseCase({ acquisition: websiteHtmlAcquisition, storage: options.artifacts.storage, now: options.now });
  return { ingestWebsitePageUseCase, ingestWebsitePagesBatchUseCase: new IngestWebsitePagesBatchUseCase({ ingestWebsitePage: ingestWebsitePageUseCase }) };
}
