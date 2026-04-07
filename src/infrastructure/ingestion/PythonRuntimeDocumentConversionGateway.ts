import type { DocumentConversionGateway, DocumentConversionRequest, DocumentConversionResult } from "@application/ingestion/DocumentConversionGateway";
import type { IPythonRuntimeClient } from "@application/ports/interfaces/IPythonRuntimeClient";

export class PythonRuntimeDocumentConversionGateway implements DocumentConversionGateway {
  constructor(private readonly runtimeClient: IPythonRuntimeClient) {}

  public async convert(request: DocumentConversionRequest): Promise<DocumentConversionResult> {
    const response = await this.runtimeClient.convertDocumentToMarkdown({
      filename: request.file.name,
      contentType: request.file.mimeType,
      outputFormat: request.outputFormat,
      content: request.content,
    });

    return Object.freeze({
      markdown: response.markdownContent,
      sourceFormat: response.sourceFormat,
      outputFormat: response.outputFormat,
      file: Object.freeze({
        ...request.file,
        extension: response.extension ?? request.file.extension,
        mimeType: response.metadata.detectedContentType ?? response.contentType ?? request.file.mimeType,
      }),
      conversion: Object.freeze({
        strategy: response.metadata.strategy,
        converterId: response.converter.id,
        converterVersion: response.converter.version,
        durationMs: response.metadata.durationMs,
        declaredSourceFormat: request.file.extension?.replace(/^\./, "") ?? request.file.mimeType,
        detectedSourceFormat: response.sourceFormat,
      }),
      warnings: Object.freeze(response.warnings.map((warning) => Object.freeze({
        code: warning.code as "filename_extension_mismatch" | "missing_content_type" | "conversion_performed" | "pass_through_normalization",
        message: warning.message,
        details: warning.details,
      }))),
    });
  }
}

