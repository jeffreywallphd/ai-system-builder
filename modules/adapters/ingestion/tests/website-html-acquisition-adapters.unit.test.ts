import { describe, expect, it, testDouble } from "../../../testing/node-test";

import { DefaultWebsiteHtmlAcquisitionPipeline } from "../../../application/services/ingestion/default-website-html-acquisition.pipeline";
import { PlaywrightWebsiteHtmlAcquisitionAdapter } from "../playwright/PlaywrightWebsiteHtmlAcquisitionAdapter";
import { SimpleHttpWebsiteHtmlAcquisitionAdapter } from "../simple-http/SimpleHttpWebsiteHtmlAcquisitionAdapter";

describe("website html acquisition adapters and pipeline", () => {
  it("simple adapter returns fetched html", async () => {
    const adapter = new SimpleHttpWebsiteHtmlAcquisitionAdapter({
      fetchImpl: async () => ({
        url: "https://example.com/simple",
        status: 200,
        headers: {
          get: () => "text/html; charset=utf-8",
        },
        text: async () => "<html><body><main><p>Simple</p></main></body></html>",
      }),
    });

    const result = await adapter.acquireWebsiteHtml({
      target: { url: "https://example.com/simple" },
      mode: "automatic",
    });

    expect(result.retrievalModeUsed).toBe("automatic");
    expect(result.html).toContain("Simple");
  });

  it("playwright adapter returns rendered html", async () => {
    const close = testDouble.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const adapter = new PlaywrightWebsiteHtmlAcquisitionAdapter({
      browserFactory: async () => ({
        newPage: async () => ({
          goto: async () => ({ status: () => 200 }),
          content: async () => "<html><body><main><p>Rendered</p></main></body></html>",
        }),
        close,
      }),
    });

    const result = await adapter.acquireWebsiteHtml({
      target: { url: "https://example.com/rendered" },
      mode: "rendered",
    });

    expect(result.retrievalModeUsed).toBe("rendered");
    expect(result.html).toContain("Rendered");
    expect(close).toHaveBeenCalledOnce();
  });

  it("pipeline falls back to advanced adapter when simple content is insufficient", async () => {
    const simple = {
      acquireWebsiteHtml: testDouble.fn().mockResolvedValue({
        resolvedUrl: "https://example.com/fallback",
        html: "<html><body></body></html>",
        mediaType: "text/html",
        retrievalModeUsed: "automatic",
      }),
    };

    const advanced = {
      acquireWebsiteHtml: testDouble.fn().mockResolvedValue({
        resolvedUrl: "https://example.com/fallback",
        html: "<html><body><main><p>Rendered fallback</p></main></body></html>",
        mediaType: "text/html",
        retrievalModeUsed: "rendered",
      }),
    };

    const pipeline = new DefaultWebsiteHtmlAcquisitionPipeline({ simple, advanced });

    const result = await pipeline.acquireWebsiteHtml({
      target: { url: "https://example.com/fallback" },
      mode: "automatic",
    });

    expect(simple.acquireWebsiteHtml).toHaveBeenCalledOnce();
    expect(advanced.acquireWebsiteHtml).toHaveBeenCalledOnce();
    expect(result.retrievalModeUsed).toBe("rendered");
  });

  it("pipeline does not fall back when simple content is sufficient", async () => {
    const simple = {
      acquireWebsiteHtml: testDouble.fn().mockResolvedValue({
        resolvedUrl: "https://example.com/sufficient",
        html: "<html><body><main><p>Enough content</p></main></body></html>",
        mediaType: "text/html",
        retrievalModeUsed: "automatic",
      }),
    };

    const advanced = {
      acquireWebsiteHtml: testDouble.fn().mockResolvedValue({
        resolvedUrl: "https://example.com/sufficient",
        html: "<html><body><main><p>Rendered</p></main></body></html>",
        mediaType: "text/html",
        retrievalModeUsed: "rendered",
      }),
    };

    const pipeline = new DefaultWebsiteHtmlAcquisitionPipeline({ simple, advanced });
    const result = await pipeline.acquireWebsiteHtml({
      target: { url: "https://example.com/sufficient" },
      mode: "automatic",
    });

    expect(simple.acquireWebsiteHtml).toHaveBeenCalledOnce();
    expect(advanced.acquireWebsiteHtml).not.toHaveBeenCalled();
    expect(result.retrievalModeUsed).toBe("automatic");
  });
});
