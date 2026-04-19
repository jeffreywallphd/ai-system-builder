import { describe, expect, it } from "../../../testing/node-test";

import {
  WEBSITE_HTML_ARTIFACT_FAMILY,
  normalizeWebsiteBatchIngestionResult,
  normalizeWebsiteHtmlCaptureMetadata,
  normalizeWebsiteIngestionMode,
  normalizeWebsiteIngestionResult,
  normalizeWebsiteIngestionTarget,
} from "..";

describe("website-ingestion domain", () => {
  it("uses structured-text as the default artifact family for website html captures", () => {
    expect(WEBSITE_HTML_ARTIFACT_FAMILY).toBe("structured-text");
  });
  it("normalizes and validates website ingestion modes", () => {
    expect(normalizeWebsiteIngestionMode(" Automatic ")).toBe("automatic");
    expect(normalizeWebsiteIngestionMode("rendered")).toBe("rendered");
    expect(() => normalizeWebsiteIngestionMode("basic")).toThrow(
      'Website ingestion mode must be one of automatic, rendered. Received "basic".',
    );
  });

  it("normalizes targets and rejects empty urls", () => {
    expect(
      normalizeWebsiteIngestionTarget({
        url: " https://example.com/docs ",
        label: " Example Docs ",
      }),
    ).toEqual({
      url: "https://example.com/docs",
      label: "Example Docs",
    });

    expect(() => normalizeWebsiteIngestionTarget({ url: "   " })).toThrow(
      'Website ingestion target url must be a non-empty trimmed string. Received "   ".',
    );
  });

  it("normalizes html capture metadata for staged-artifact metadata compatibility", () => {
    const metadata = normalizeWebsiteHtmlCaptureMetadata({
      sourceUrl: " https://example.com/start ",
      resolvedUrl: " https://example.com/final ",
      retrievedAt: " 2026-04-19T00:00:00.000Z ",
      retrievalModeUsed: " rendered ",
      rendered: true,
      httpStatus: 200,
      contentTypeHeader: " text/html; charset=utf-8 ",
    });

    expect(metadata).toEqual({
      sourceUrl: "https://example.com/start",
      resolvedUrl: "https://example.com/final",
      retrievedAt: "2026-04-19T00:00:00.000Z",
      retrievalModeUsed: "rendered",
      rendered: true,
      httpStatus: 200,
      contentTypeHeader: "text/html; charset=utf-8",
    });
  });

  it("normalizes single-item and batch website ingestion summaries", () => {
    const item = normalizeWebsiteIngestionResult({
      target: {
        url: " https://example.com/page ",
      },
      resolvedUrl: " https://example.com/page ",
      retrievalModeUsed: " automatic ",
      warnings: [" used rendered fallback ", "   "],
    });

    expect(item).toMatchObject({
      target: {
        url: "https://example.com/page",
      },
      resolvedUrl: "https://example.com/page",
      retrievalModeUsed: "automatic",
      warnings: ["used rendered fallback"],
    });

    const batch = normalizeWebsiteBatchIngestionResult({
      items: [item],
      summary: {
        attempted: 1,
        succeeded: 1,
        failed: 0,
      },
    });

    expect(batch.summary).toEqual({
      attempted: 1,
      succeeded: 1,
      failed: 0,
    });

    expect(() =>
      normalizeWebsiteBatchIngestionResult({
        items: [item],
        summary: {
          attempted: 2,
          succeeded: 1,
          failed: 0,
        },
      }),
    ).toThrow("Batch summary attempted count must equal item count (1).");
  });
});
