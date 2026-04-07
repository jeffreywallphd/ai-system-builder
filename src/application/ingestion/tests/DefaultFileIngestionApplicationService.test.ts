import { describe, expect, it } from "bun:test";
import { DefaultFileIngestionApplicationService } from "../DefaultFileIngestionApplicationService";
import { createFileIngestionProfile } from "../IngestionProfiles";
import { FileIngestionPolicyService } from "@domain/ingestion/FileIngestionServices";

const profile = createFileIngestionProfile({
  id: "dataset-source",
  capability: "dataset-source-ingestion",
  policy: {
    acceptedExtensions: [".md", ".txt", ".pdf"],
    acceptedMimeTypes: ["text/markdown", "text/plain", "application/pdf"],
    maxFileSizeBytes: 2048,
    conversion: {
      mode: "optional",
      allowedOutputFormats: ["markdown"],
      passThroughExtensions: [".md", ".txt"],
      passThroughMimeTypes: ["text/markdown", "text/plain"],
    },
  },
});

describe("DefaultFileIngestionApplicationService", () => {
  it("passes through markdown without invoking conversion", async () => {
    const service = new DefaultFileIngestionApplicationService(
      new FileIngestionPolicyService(),
      {
        async convert() {
          throw new Error("should not be called");
        },
      },
    );

    const result = await service.ingestFile(profile, {
      file: { name: "notes.md", sizeInBytes: 12, mimeType: "text/markdown" },
      content: "# Ready",
      provenance: { source: "test", capturedAt: new Date() },
    });

    expect(result.document.markdown).toBe("# Ready");
    expect(result.document.conversion.strategy).toBe("pass_through");
  });

  it("delegates conversion through the abstraction for binary documents", async () => {
    const service = new DefaultFileIngestionApplicationService(
      new FileIngestionPolicyService(),
      {
        async convert(request) {
          expect(request.outputFormat).toBe("markdown");
          return {
            markdown: "# Converted",
            sourceFormat: "pdf",
            outputFormat: "markdown",
            file: request.file,
            conversion: {
              strategy: "converted",
              converterId: "stub-converter",
              detectedSourceFormat: "pdf",
            },
            warnings: [{ code: "conversion_performed", message: "converted" }],
          };
        },
      },
    );

    const result = await service.ingestFile(profile, {
      file: { name: "paper.pdf", sizeInBytes: 128, mimeType: "application/pdf" },
      content: new Uint8Array([1, 2, 3]),
      provenance: { source: "test", capturedAt: new Date() },
    });

    expect(result.document.markdown).toBe("# Converted");
    expect(result.document.conversion.strategy).toBe("converted");
    expect(result.warnings).toHaveLength(1);
  });

  it("propagates runtime unavailability as a typed ingestion error", async () => {
    const service = new DefaultFileIngestionApplicationService(
      new FileIngestionPolicyService(),
      {
        async convert() {
          throw new Error("Python runtime is disabled in settings.");
        },
      },
    );

    await expect(service.ingestFile(profile, {
      file: { name: "paper.pdf", sizeInBytes: 128, mimeType: "application/pdf" },
      content: new Uint8Array([1, 2, 3]),
      provenance: { source: "test", capturedAt: new Date() },
    })).rejects.toMatchObject({ code: "runtime_unavailable" });
  });
});

