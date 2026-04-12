import { describe, expect, it } from "bun:test";
import { FileIngestionPolicyService } from "../FileIngestionServices";

const policy = Object.freeze({
  acceptedExtensions: [".pdf", ".docx", ".pptx", ".md", ".txt"],
  acceptedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/markdown",
    "text/plain",
  ],
  maxFileSizeBytes: 1024,
  allowMissingMimeType: true,
  mismatchWarningsEnabled: true,
  conversion: {
    mode: "optional" as const,
    allowedOutputFormats: ["markdown" as const],
    passThroughExtensions: [".md", ".txt"],
    passThroughMimeTypes: ["text/markdown", "text/plain"],
  },
});

const service = new FileIngestionPolicyService();

describe("FileIngestionPolicyService", () => {
  it("enforces accepted file types", () => {
    expect(() => service.evaluateRequest({
      file: { name: "notes.exe", sizeInBytes: 20, mimeType: "application/octet-stream" },
      content: new Uint8Array([1, 2]),
      provenance: { source: "test", capturedAt: new Date() },
    }, policy)).toThrow(/accepted file type/);
  });

  it("enforces file size limits", () => {
    expect(() => service.evaluateRequest({
      file: { name: "large.pdf", sizeInBytes: 2048, mimeType: "application/pdf" },
      content: new Uint8Array([1]),
      provenance: { source: "test", capturedAt: new Date() },
    }, policy)).toThrow(/maximum allowed size/);
  });

  it("decides pass-through for markdown text", () => {
    const evaluation = service.evaluateRequest({
      file: { name: "notes.md", sizeInBytes: 12, mimeType: "text/markdown" },
      content: "# Title",
      provenance: { source: "test", capturedAt: new Date() },
    }, policy);

    expect(evaluation.requiresConversion).toBe(false);
    expect(evaluation.sourceFormat).toBe("markdown");
  });

  it("decides conversion for office documents", () => {
    const evaluation = service.evaluateRequest({
      file: {
        name: "deck.pptx",
        sizeInBytes: 90,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
      content: new Uint8Array([1, 2, 3]),
      provenance: { source: "test", capturedAt: new Date() },
    }, policy);

    expect(evaluation.requiresConversion).toBe(true);
    expect(evaluation.sourceFormat).toBe("pptx");
  });

  it("adds mismatch warnings when extension and mime disagree", () => {
    const evaluation = service.evaluateRequest({
      file: { name: "notes.md", sizeInBytes: 12, mimeType: "text/plain" },
      content: "# Title",
      provenance: { source: "test", capturedAt: new Date() },
    }, policy);

    expect(evaluation.warnings.some((warning) => warning.code === "filename_extension_mismatch")).toBe(true);
  });

  it("accepts policies that declare extensions without a leading dot", () => {
    const evaluation = service.evaluateRequest({
      file: { name: "photo.jpg", sizeInBytes: 40, mimeType: "image/jpeg" },
      content: new Uint8Array([1, 2, 3]),
      provenance: { source: "test", capturedAt: new Date() },
    }, {
      acceptedExtensions: ["jpg", "png"],
      acceptedMimeTypes: ["image/jpeg", "image/png"],
      maxFileSizeBytes: 1024,
      conversion: {
        mode: "forbidden",
        allowedOutputFormats: [],
        passThroughExtensions: ["jpg", "png"],
        passThroughMimeTypes: ["image/jpeg", "image/png"],
      },
    });

    expect(evaluation.requiresConversion).toBe(false);
    expect(evaluation.descriptor.extension).toBe(".jpg");
  });

  it("builds normalized pass-through output", () => {
    const document = service.buildPassThroughDocument({
      descriptor: { name: "notes.txt", extension: ".txt", mimeType: "text/plain", sizeInBytes: 5 },
      provenance: { source: "test", capturedAt: new Date() },
      sourceFormat: "text",
      content: "hello",
    });

    expect(document.outputFormat).toBe("markdown");
    expect(document.markdown).toBe("hello");
    expect(document.conversion.strategy).toBe("pass_through");
  });
});
