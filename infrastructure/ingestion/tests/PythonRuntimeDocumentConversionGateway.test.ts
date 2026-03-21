import { describe, expect, it } from "bun:test";
import { PythonRuntimeDocumentConversionGateway } from "../PythonRuntimeDocumentConversionGateway";

describe("PythonRuntimeDocumentConversionGateway", () => {
  it("maps python runtime conversion responses into application models", async () => {
    const gateway = new PythonRuntimeDocumentConversionGateway({
      async health() {
        return { status: "ok", runtime: "python" } as const;
      },
      async executeNode() {
        throw new Error("unused");
      },
      async executeWorkflow() {
        throw new Error("unused");
      },
      async convertDocumentToMarkdown() {
        return {
          success: true,
          filename: "report.pdf",
          contentType: "application/pdf",
          extension: ".pdf",
          sourceFormat: "pdf",
          outputFormat: "markdown",
          markdownContent: "# Report",
          converter: { id: "python-markitdown", version: "0.1.5" },
          warnings: [{ code: "conversion_performed", message: "Converted." }],
          metadata: {
            strategy: "converted",
            durationMs: 44,
            detectedContentType: "application/pdf",
            declaredContentType: "application/pdf",
          },
        };
      },
    });

    const result = await gateway.convert({
      file: { name: "report.pdf", extension: ".pdf", mimeType: "application/pdf", sizeInBytes: 15 },
      content: new Uint8Array([1, 2, 3]),
      outputFormat: "markdown",
    });

    expect(result.markdown).toBe("# Report");
    expect(result.conversion.converterId).toBe("python-markitdown");
    expect(result.file.mimeType).toBe("application/pdf");
  });
});
