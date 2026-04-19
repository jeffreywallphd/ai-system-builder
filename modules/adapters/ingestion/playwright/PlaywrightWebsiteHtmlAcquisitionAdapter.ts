import {
  normalizeWebsiteHtmlAcquisitionRequest,
  normalizeWebsiteHtmlAcquisitionResult,
  type WebsiteHtmlAcquisitionRequest,
  type WebsiteHtmlAcquisitionResult,
} from "../../../contracts/ingestion";
import type { WebsiteHtmlAcquisitionStrategy } from "../../../application/ports/ingestion";
import type { ApplicationRequestContext } from "../../../application/ports";

interface PlaywrightPage {
  goto(url: string, options: { waitUntil: "domcontentloaded"; timeout: number }): Promise<{ status(): number | null } | null>;
  content(): Promise<string>;
}

interface PlaywrightBrowser {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

type BrowserFactory = () => Promise<PlaywrightBrowser>;

export interface PlaywrightWebsiteHtmlAcquisitionAdapterDependencies {
  browserFactory?: BrowserFactory;
  navigationTimeoutMs?: number;
}

async function defaultBrowserFactory(): Promise<PlaywrightBrowser> {
  const playwrightModule = await import("playwright");
  return playwrightModule.chromium.launch({ headless: true });
}

export class PlaywrightWebsiteHtmlAcquisitionAdapter implements WebsiteHtmlAcquisitionStrategy {
  private readonly browserFactory: BrowserFactory;
  private readonly navigationTimeoutMs: number;

  public constructor(dependencies?: PlaywrightWebsiteHtmlAcquisitionAdapterDependencies) {
    this.browserFactory = dependencies?.browserFactory ?? defaultBrowserFactory;
    this.navigationTimeoutMs = dependencies?.navigationTimeoutMs ?? 15000;
  }

  public async acquireWebsiteHtml(
    request: WebsiteHtmlAcquisitionRequest,
    _context?: ApplicationRequestContext,
  ): Promise<WebsiteHtmlAcquisitionResult> {
    const normalizedRequest = normalizeWebsiteHtmlAcquisitionRequest(request);

    const browser = await this.browserFactory();

    try {
      const page = await browser.newPage();
      const navigation = await page.goto(normalizedRequest.target.url, {
        waitUntil: "domcontentloaded",
        timeout: this.navigationTimeoutMs,
      });
      const html = (await page.content()).trim();

      return normalizeWebsiteHtmlAcquisitionResult({
        sourceKind: "scrape",
        resolvedUrl: normalizedRequest.target.url,
        html,
        mediaType: "text/html",
        retrievalModeUsed: "rendered",
        httpStatus: navigation?.status() ?? undefined,
        contentTypeHeader: "text/html",
      });
    } finally {
      await browser.close();
    }
  }
}
