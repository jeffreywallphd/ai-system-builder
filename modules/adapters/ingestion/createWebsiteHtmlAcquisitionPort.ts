import type { WebsiteHtmlAcquisitionPort } from "../../application/ports/ingestion";
import { DefaultWebsiteHtmlAcquisitionPipeline } from "../../application/services/ingestion";

import { PlaywrightWebsiteHtmlAcquisitionAdapter } from "./playwright/PlaywrightWebsiteHtmlAcquisitionAdapter";
import { SimpleHttpWebsiteHtmlAcquisitionAdapter } from "./simple-http/SimpleHttpWebsiteHtmlAcquisitionAdapter";

export function createWebsiteHtmlAcquisitionPort(): WebsiteHtmlAcquisitionPort {
  return new DefaultWebsiteHtmlAcquisitionPipeline({
    simple: new SimpleHttpWebsiteHtmlAcquisitionAdapter(),
    advanced: new PlaywrightWebsiteHtmlAcquisitionAdapter(),
  });
}
