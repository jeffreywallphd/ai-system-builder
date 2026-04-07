import { z } from "zod";
import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalTextItemsShape, type CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { DataSourceReferenceKinds, type DataSourceReference, type ResolvedDataSource } from "./DataConverterContracts";
import { DefaultDataSourceLocator, type IDataSourceLocator } from "./DataSourceLocator";
import {
  DataAssetConfigFieldKinds,
  DataAssetConfigFieldVisibilities,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";
import {
  IngestionIssueCategories,
  IngestionIssueRecoverabilities,
  IngestionExecutionContextSchema,
  contextToIssueSource,
  createIngestionIssue,
  toIngestionIssueFromError,
  toIngestionIssuesFromZodError,
  type IngestionExecutionContext,
  type IngestionIssue,
} from "./IngestionContracts";
import {
  buildIngestionFailureEnvelope,
  buildIngestionPreviewEnvelope,
  buildIngestionSuccessEnvelope,
  normalizeDocumentTextItemsOutput,
  type IngestionFailureEnvelope,
  type IngestionPreviewEnvelope,
  type IngestionSuccessEnvelope,
} from "./IngestionCanonicalNormalization";

export const DocumentPdfIngestorErrorCodes = Object.freeze({
  invalidConfig: "document-pdf-ingestor-invalid-config",
  unreadableSource: "document-pdf-ingestor-unreadable-source",
  unsupportedType: "document-pdf-ingestor-unsupported-type",
  pdfParseFailed: "document-pdf-ingestor-pdf-parse-failed",
  emptyExtraction: "document-pdf-ingestor-empty-extraction",
} as const);

export type DocumentPdfIngestorErrorCode =
  typeof DocumentPdfIngestorErrorCodes[keyof typeof DocumentPdfIngestorErrorCodes];

export interface DocumentPdfIngestorDiagnostic {
  readonly code: DocumentPdfIngestorErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export const DocumentPdfIngestorConfigSchema = z.object({
  includePageText: z.boolean().default(true),
  maxPages: z.number().int().positive().optional(),
  previewPageCount: z.number().int().positive().max(10).default(3),
  extractMetadata: z.boolean().default(true),
  preservePageBoundaries: z.boolean().default(true),
});

export type DocumentPdfIngestorConfig = z.output<typeof DocumentPdfIngestorConfigSchema>;

export interface DocumentPdfOcrPage {
  readonly pageNumber: number;
  readonly text: string;
}

export interface DocumentPdfOcrResult {
  readonly pages: ReadonlyArray<DocumentPdfOcrPage>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IDocumentPdfOcrStrategy {
  extractTextFromPdf(request: {
    readonly payload: Uint8Array;
    readonly source: ResolvedDataSource;
    readonly maxPages?: number;
  }): Promise<DocumentPdfOcrResult | undefined>;
}

interface ParsedPdfPage {
  readonly pageNumber: number;
  readonly text: string;
}

interface ParsedPdfResult {
  readonly totalPages: number;
  readonly pages: ReadonlyArray<ParsedPdfPage>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IDocumentPdfParser {
  parse(request: {
    readonly payload: Uint8Array;
    readonly maxPages?: number;
    readonly extractMetadata: boolean;
  }): Promise<ParsedPdfResult>;
}

class DefaultDocumentPdfParser implements IDocumentPdfParser {
  public async parse(request: {
    readonly payload: Uint8Array;
    readonly maxPages?: number;
    readonly extractMetadata: boolean;
  }): Promise<ParsedPdfResult> {
    let moduleRecord: Readonly<Record<string, unknown>>;
    try {
      moduleRecord = await import("unpdf") as Readonly<Record<string, unknown>>;
    } catch (error) {
      throw new Error(`Unable to load 'unpdf': ${error instanceof Error ? error.message : String(error)}`);
    }

    const extractText = (
      moduleRecord.extractText
      ?? moduleRecord.extractPDFText
    ) as ((data: Uint8Array, options?: Readonly<Record<string, unknown>>) => Promise<unknown>) | undefined;
    if (typeof extractText !== "function") {
      throw new Error("'unpdf' text extraction API is unavailable.");
    }

    const extractResult = await extractText(request.payload, { mergePages: false });
    const extract = extractResult as {
      readonly totalPages?: number;
      readonly text?: unknown;
    };

    const rawPages = Array.isArray(extract.text)
      ? extract.text
      : typeof extract.text === "string"
        ? [extract.text]
        : [];
    const bounded = request.maxPages ? rawPages.slice(0, request.maxPages) : rawPages;

    let metadata: Readonly<Record<string, unknown>> | undefined;
    if (request.extractMetadata) {
      const getMeta = moduleRecord.getMeta as ((data: Uint8Array) => Promise<unknown>) | undefined;
      if (typeof getMeta === "function") {
        try {
          const metaResult = await getMeta(request.payload);
          if (metaResult && typeof metaResult === "object") {
            metadata = Object.freeze({ ...(metaResult as Record<string, unknown>) });
          }
        } catch {
          metadata = undefined;
        }
      }
    }

    return Object.freeze({
      totalPages: extract.totalPages ?? rawPages.length,
      pages: Object.freeze(bounded.map((text, index) => Object.freeze({
        pageNumber: index + 1,
        text: typeof text === "string" ? text : "",
      }))),
      metadata,
    });
  }
}

export interface DocumentPdfIngestorExecutionRequest {
  readonly source: ResolvedDataSource;
  readonly config?: Partial<DocumentPdfIngestorConfig>;
  readonly documentId?: string;
  readonly context?: Partial<IngestionExecutionContext>;
}

export interface DocumentPdfIngestorResolveRequest {
  readonly source: DataSourceReference;
  readonly config?: Partial<DocumentPdfIngestorConfig>;
  readonly documentId?: string;
}

export interface DocumentPdfIngestorPreviewPage {
  readonly pageNumber: number;
  readonly textExcerpt: string;
  readonly charCount: number;
}

export interface DocumentPdfIngestorPreviewResult {
  readonly pageCount: number;
  readonly fullTextExcerpt: string;
  readonly pages: ReadonlyArray<DocumentPdfIngestorPreviewPage>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly source: {
    readonly reference: string;
    readonly fileName?: string;
    readonly contentType?: string;
    readonly format: "pdf" | "text";
  };
  readonly normalized: IngestionPreviewEnvelope;
}

export interface DocumentPdfIngestorExecutionSuccess {
  readonly ok: true;
  readonly config: DocumentPdfIngestorConfig;
  readonly output: ReturnType<typeof createCanonicalTextItemsShape>;
  readonly normalized: IngestionSuccessEnvelope<ReturnType<typeof createCanonicalTextItemsShape>>;
  readonly fullText: string;
  readonly pageCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly preview: DocumentPdfIngestorPreviewResult;
  readonly diagnostics: ReadonlyArray<DocumentPdfIngestorDiagnostic>;
}

export interface DocumentPdfIngestorExecutionFailure {
  readonly ok: false;
  readonly normalized: IngestionFailureEnvelope;
  readonly diagnostics: ReadonlyArray<DocumentPdfIngestorDiagnostic>;
}

export type DocumentPdfIngestorExecutionResult =
  | DocumentPdfIngestorExecutionSuccess
  | DocumentPdfIngestorExecutionFailure;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function inferSourceFormat(source: ResolvedDataSource): "pdf" | "text" | "unsupported" {
  const fileName = normalizeOptional(source.fileName)?.toLowerCase();
  const contentType = normalizeOptional(source.contentType)?.toLowerCase();
  if (contentType === "application/pdf" || fileName?.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    contentType?.startsWith("text/")
    || fileName?.endsWith(".txt")
    || fileName?.endsWith(".md")
    || fileName?.endsWith(".text")
  ) {
    return "text";
  }
  return "unsupported";
}

function toUint8Array(payload: ResolvedDataSource["payload"]): Uint8Array | undefined {
  if (payload instanceof Uint8Array) {
    return payload;
  }
  if (typeof payload === "string") {
    return new TextEncoder().encode(payload);
  }
  return undefined;
}

function clipText(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 3))}...`;
}

function toCanonicalRecordValue(value: unknown): CanonicalRecordValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => toCanonicalRecordValue(entry)));
  }
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toCanonicalRecordValue(entry)]),
    ));
  }
  return String(value);
}

function buildPreview(input: {
  readonly ingestor: string;
  readonly ingestorVersion?: string;
  readonly context: IngestionExecutionContext;
  readonly pageEntries: ReadonlyArray<{ readonly pageNumber: number; readonly text: string }>;
  readonly pageCount: number;
  readonly fullText: string;
  readonly previewPageCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly source: ResolvedDataSource;
  readonly format: "pdf" | "text";
  readonly configSummary?: Readonly<Record<string, unknown>>;
  readonly issues?: ReadonlyArray<IngestionIssue>;
}): DocumentPdfIngestorPreviewResult {
  const pageSample = input.pageEntries.slice(0, input.previewPageCount);
  const previewIssues = input.pageEntries.length > pageSample.length
    ? Object.freeze([createIngestionIssue({
      code: "document-pdf-preview-truncated",
      message: "Preview pages were truncated to keep preview execution bounded.",
      category: IngestionIssueCategories.previewFailure,
      severity: "warning",
      recoverability: IngestionIssueRecoverabilities.partial,
      source: contextToIssueSource(input.context),
      details: Object.freeze({
        pageCount: input.pageEntries.length,
        sampleCount: pageSample.length,
      }),
    })])
    : Object.freeze([]);
  return Object.freeze({
    pageCount: input.pageCount,
    fullTextExcerpt: clipText(input.fullText, 500),
    pages: Object.freeze(pageSample.map((entry) => Object.freeze({
      pageNumber: entry.pageNumber,
      textExcerpt: clipText(entry.text, 180),
      charCount: entry.text.length,
    }))),
    metadata: input.metadata,
    source: Object.freeze({
      reference: input.source.reference,
      fileName: input.source.fileName,
      contentType: input.source.contentType,
      format: input.format,
    }),
    normalized: buildIngestionPreviewEnvelope({
      ingestor: input.ingestor,
      context: input.context,
      asset: Object.freeze({
        assetId: input.ingestor,
        assetVersion: input.ingestorVersion,
      }),
      configSummary: input.configSummary,
      totalCount: input.pageEntries.length,
      sampleCount: pageSample.length,
      preview: {
        kind: "text-items",
        summary: {
          totalCount: input.pageEntries.length,
          sampleCount: pageSample.length,
          truncated: pageSample.length < input.pageEntries.length,
        },
        metadata: {
          schemaVersion: "1.0.0",
          sourceFileName: input.source.fileName,
          sourceFormat: input.format,
          lineageCount: 0,
        },
        diagnostics: {
          infoCount: 0,
          warningCount: previewIssues.length,
          errorCount: 0,
          diagnostics: Object.freeze([]),
        },
        items: Object.freeze(pageSample.map((entry) => Object.freeze({
          itemId: `preview-page-${entry.pageNumber}`,
          text: clipText(entry.text, 180),
        }))),
      },
      metadata: input.metadata,
      issues: Object.freeze([...(input.issues ?? []), ...previewIssues]),
    }),
  });
}

export interface DocumentPdfIngestorAssetOptions {
  readonly sourceLocator?: IDataSourceLocator;
  readonly pdfParser?: IDocumentPdfParser;
  readonly ocrStrategy?: IDocumentPdfOcrStrategy;
}

export class DocumentPdfIngestorAsset {
  public static readonly assetId = "document-pdf-ingestor";
  public static readonly assetVersion = "1.0.0";

  public readonly inputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "Document source reference/resolved payload and PDF ingestion configuration.",
  });

  public readonly outputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "Canonical text-items output preserving page-level document structure.",
  });

  private readonly sourceLocator: IDataSourceLocator;
  private readonly pdfParser: IDocumentPdfParser;
  private readonly ocrStrategy?: IDocumentPdfOcrStrategy;

  constructor(options: DocumentPdfIngestorAssetOptions = {}) {
    this.sourceLocator = options.sourceLocator ?? new DefaultDataSourceLocator();
    this.pdfParser = options.pdfParser ?? new DefaultDocumentPdfParser();
    this.ocrStrategy = options.ocrStrategy;
  }

  public async resolveAndExecute(request: DocumentPdfIngestorResolveRequest): Promise<DocumentPdfIngestorExecutionResult> {
    const assetIdentity = Object.freeze({
      assetId: DocumentPdfIngestorAsset.assetId,
      assetVersion: DocumentPdfIngestorAsset.assetVersion,
    });
    try {
      const source = await this.sourceLocator.resolve({ source: request.source });
      return this.execute({
        source,
        config: request.config,
        documentId: request.documentId,
      });
    } catch (error) {
      const context = IngestionExecutionContextSchema.parse({});
      const issues = Object.freeze([toIngestionIssueFromError({
        code: DocumentPdfIngestorErrorCodes.unreadableSource,
        message: "Unable to resolve source reference for document ingestion.",
        error,
        category: IngestionIssueCategories.unreadableSource,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource({
          sourceReference: request.source.kind === DataSourceReferenceKinds.localFile
            ? request.source.path
            : request.source.kind === DataSourceReferenceKinds.url
              ? request.source.url
              : "in-memory",
        }),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: DocumentPdfIngestorErrorCodes.unreadableSource,
          message: "Unable to resolve source reference for document ingestion.",
          details: Object.freeze({
            cause: error instanceof Error ? error.message : String(error),
            sourceKind: request.source.kind,
            sourceReference: request.source.kind === DataSourceReferenceKinds.localFile
              ? request.source.path
              : request.source.kind === DataSourceReferenceKinds.url
                ? request.source.url
                : "in-memory",
          }),
        } satisfies DocumentPdfIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context,
          issues,
          asset: assetIdentity,
          configSummary: request.config,
        }),
      });
    }
  }

  public async execute(request: DocumentPdfIngestorExecutionRequest): Promise<DocumentPdfIngestorExecutionResult> {
    const assetIdentity = Object.freeze({
      assetId: DocumentPdfIngestorAsset.assetId,
      assetVersion: DocumentPdfIngestorAsset.assetVersion,
    });
    const parsedConfig = DocumentPdfIngestorConfigSchema.safeParse(request.config ?? {});
    if (!parsedConfig.success) {
      const parsedContext = IngestionExecutionContextSchema.safeParse(request.context ?? {});
      const issues = toIngestionIssuesFromZodError(parsedConfig.error, DocumentPdfIngestorErrorCodes.invalidConfig, {
        category: IngestionIssueCategories.invalidConfiguration,
        source: contextToIssueSource(parsedContext.success ? parsedContext.data : request.context),
      });
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze(parsedConfig.error.issues.map((issue) => Object.freeze({
          code: DocumentPdfIngestorErrorCodes.invalidConfig,
          message: issue.message,
          path: issue.path.join("."),
        } satisfies DocumentPdfIngestorDiagnostic))),
        normalized: buildIngestionFailureEnvelope({
          context: parsedContext.success ? parsedContext.data : IngestionExecutionContextSchema.parse({}),
          issues,
          asset: assetIdentity,
          configSummary: request.config,
        }),
      });
    }

    const config = parsedConfig.data;
    const ingestionContext = IngestionExecutionContextSchema.parse({
      ...request.context,
      sourceReference: request.source.reference,
      sourceAssetId: request.source.sourceAssetId,
      sourceVersionId: request.source.sourceVersionId,
      fileName: request.source.fileName,
      contentType: request.source.contentType,
    });
    const sourceFormat = inferSourceFormat(request.source);
    if (sourceFormat === "unsupported") {
      const issues = Object.freeze([createIngestionIssue({
        code: DocumentPdfIngestorErrorCodes.unsupportedType,
        message: "Document ingestor supports PDF and text sources only.",
        category: IngestionIssueCategories.unsupportedSourceType,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: DocumentPdfIngestorErrorCodes.unsupportedType,
          message: "Document ingestor supports PDF and text sources only.",
          details: Object.freeze({
            fileName: request.source.fileName,
            contentType: request.source.contentType,
          }),
          } satisfies DocumentPdfIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    if (sourceFormat === "text") {
      const text = typeof request.source.payload === "string"
        ? request.source.payload
        : new TextDecoder("utf-8").decode(toUint8Array(request.source.payload) ?? new Uint8Array());
      const normalizedText = text.replace(/\r\n/g, "\n").trim();
      if (!normalizedText) {
        const issues = Object.freeze([createIngestionIssue({
          code: DocumentPdfIngestorErrorCodes.emptyExtraction,
          message: "Text source did not produce any extractable content.",
          category: IngestionIssueCategories.parseExtractionFailure,
          recoverability: IngestionIssueRecoverabilities.fixSource,
          source: contextToIssueSource(ingestionContext),
        })]);
        return Object.freeze({
          ok: false,
          diagnostics: Object.freeze([Object.freeze({
            code: DocumentPdfIngestorErrorCodes.emptyExtraction,
            message: "Text source did not produce any extractable content.",
          } satisfies DocumentPdfIngestorDiagnostic)]),
          normalized: buildIngestionFailureEnvelope({
            context: ingestionContext,
            issues,
            asset: assetIdentity,
            configSummary: config,
          }),
        });
      }

      const itemId = `text-item-${normalizeOptional(request.documentId) ?? "document"}-1`;
      const output = createCanonicalTextItemsShape({
        items: Object.freeze([Object.freeze({
          itemId,
          text: normalizedText,
          sourceDocumentId: normalizeOptional(request.documentId) ?? normalizeOptional(request.source.fileName) ?? "document-1",
          metadata: Object.freeze({
            pageNumber: 1,
            sectionType: "full-document",
            sourceFormat: "text",
          }),
        })]),
        metadata: {
          schemaVersion: "1.0.0",
          source: {
            fileName: request.source.fileName,
            contentType: request.source.contentType,
            format: "text",
          },
          attributes: {
            fullText: normalizedText,
            pageCount: 1,
            sourceReference: request.source.reference,
          },
        },
      });

      const normalizedOutput = normalizeDocumentTextItemsOutput({
        output,
        context: {
          ...ingestionContext,
          formatHint: "text",
        },
      });
      const preview = buildPreview({
        ingestor: DocumentPdfIngestorAsset.assetId,
        context: ingestionContext,
        pageEntries: Object.freeze([{ pageNumber: 1, text: normalizedText }]),
        pageCount: 1,
        fullText: normalizedText,
        previewPageCount: config.previewPageCount,
        metadata: Object.freeze({}),
        source: request.source,
        format: "text",
        ingestorVersion: DocumentPdfIngestorAsset.assetVersion,
        configSummary: config,
      });

      return Object.freeze({
        ok: true,
        config,
        output: normalizedOutput,
        normalized: buildIngestionSuccessEnvelope({
          output: normalizedOutput,
          context: ingestionContext,
          asset: assetIdentity,
          configSummary: config,
        }),
        fullText: normalizedText,
        pageCount: 1,
        metadata: Object.freeze({}),
        preview,
        diagnostics: Object.freeze([]),
      });
    }

    const binaryPayload = toUint8Array(request.source.payload);
    if (!binaryPayload || binaryPayload.length === 0) {
      const issues = Object.freeze([createIngestionIssue({
        code: DocumentPdfIngestorErrorCodes.unreadableSource,
        message: "PDF source payload is missing or unreadable.",
        category: IngestionIssueCategories.unreadableSource,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: DocumentPdfIngestorErrorCodes.unreadableSource,
          message: "PDF source payload is missing or unreadable.",
          details: Object.freeze({ reference: request.source.reference }),
        } satisfies DocumentPdfIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    let parsedPdf: ParsedPdfResult;
    try {
      parsedPdf = await this.pdfParser.parse({
        payload: binaryPayload,
        maxPages: config.maxPages,
        extractMetadata: config.extractMetadata,
      });
    } catch (error) {
      const issues = Object.freeze([toIngestionIssueFromError({
        code: DocumentPdfIngestorErrorCodes.pdfParseFailed,
        message: "PDF parsing failed.",
        error,
        category: IngestionIssueCategories.parseExtractionFailure,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: DocumentPdfIngestorErrorCodes.pdfParseFailed,
          message: "PDF parsing failed.",
          details: Object.freeze({
            cause: error instanceof Error ? error.message : String(error),
            reference: request.source.reference,
          }),
        } satisfies DocumentPdfIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    const parserPages = parsedPdf.pages.filter((page) => page.text.trim().length > 0);
    let pages = parserPages;
    let extractedMetadata = parsedPdf.metadata ?? Object.freeze({});

    if (pages.length === 0 && this.ocrStrategy) {
      const ocrResult = await this.ocrStrategy.extractTextFromPdf({
        payload: binaryPayload,
        source: request.source,
        maxPages: config.maxPages,
      });
      if (ocrResult) {
        pages = ocrResult.pages
          .map((page) => Object.freeze({ pageNumber: page.pageNumber, text: page.text }))
          .filter((page) => page.text.trim().length > 0);
        extractedMetadata = Object.freeze({
          ...extractedMetadata,
          ocrApplied: true,
          ocrMetadata: ocrResult.metadata ?? undefined,
        });
      }
    }

    if (pages.length === 0) {
      const issues = Object.freeze([createIngestionIssue({
        code: DocumentPdfIngestorErrorCodes.emptyExtraction,
        message: "PDF did not produce any extractable text.",
        category: IngestionIssueCategories.parseExtractionFailure,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: DocumentPdfIngestorErrorCodes.emptyExtraction,
          message: "PDF did not produce any extractable text.",
          details: Object.freeze({
            totalPages: parsedPdf.totalPages,
            hasOcrStrategy: Boolean(this.ocrStrategy),
          }),
        } satisfies DocumentPdfIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    const fullText = pages.map((entry) => entry.text.trim()).filter(Boolean).join("\n\n");
    const normalizedDocumentId = normalizeOptional(request.documentId)
      ?? normalizeOptional(request.source.fileName)
      ?? "document-1";

    const canonicalItems = config.includePageText
      ? pages.map((page, index) => Object.freeze({
        itemId: `text-item-${normalizedDocumentId}-${index + 1}`,
        text: page.text,
        sourceDocumentId: normalizedDocumentId,
        metadata: Object.freeze({
          pageNumber: page.pageNumber,
          sourceFormat: "pdf",
          preservePageBoundaries: config.preservePageBoundaries,
        }),
      }))
      : [Object.freeze({
        itemId: `text-item-${normalizedDocumentId}-full`,
        text: fullText,
        sourceDocumentId: normalizedDocumentId,
        metadata: Object.freeze({
          sourceFormat: "pdf",
          preservePageBoundaries: false,
        }),
      })];

    const output = createCanonicalTextItemsShape({
      items: Object.freeze(canonicalItems),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          fileName: request.source.fileName,
          contentType: request.source.contentType,
          format: "pdf",
        },
        attributes: {
          fullText,
          pageCount: parsedPdf.totalPages || pages.length,
          extractedPageCount: pages.length,
          sourceReference: request.source.reference,
          parserMetadata: toCanonicalRecordValue(extractedMetadata),
        },
      },
    });

    const normalizedOutput = normalizeDocumentTextItemsOutput({
      output,
      context: {
        ...ingestionContext,
        formatHint: "pdf",
      },
      additionalAttributes: Object.freeze({
        sourceReference: request.source.reference,
      }),
    });
    const previewIssues = config.extractMetadata && Object.keys(extractedMetadata).length === 0
      ? Object.freeze([createIngestionIssue({
        code: "document-pdf-metadata-missing",
        message: "PDF metadata was not available from the parser.",
        category: IngestionIssueCategories.previewFailure,
        severity: "warning",
        recoverability: IngestionIssueRecoverabilities.partial,
        source: contextToIssueSource(ingestionContext),
      })])
      : Object.freeze([]);
    const preview = buildPreview({
      ingestor: DocumentPdfIngestorAsset.assetId,
      context: ingestionContext,
      pageEntries: Object.freeze(pages.map((page) => Object.freeze({ pageNumber: page.pageNumber, text: page.text }))),
      pageCount: parsedPdf.totalPages || pages.length,
      fullText,
      previewPageCount: config.previewPageCount,
      metadata: extractedMetadata,
      source: request.source,
      format: "pdf",
      ingestorVersion: DocumentPdfIngestorAsset.assetVersion,
      configSummary: config,
      issues: previewIssues,
    });

    return Object.freeze({
      ok: true,
      config,
      output: normalizedOutput,
      normalized: buildIngestionSuccessEnvelope({
        output: normalizedOutput,
        context: ingestionContext,
        asset: assetIdentity,
        configSummary: config,
      }),
      fullText,
      pageCount: parsedPdf.totalPages || pages.length,
      metadata: extractedMetadata,
      preview,
      diagnostics: Object.freeze([]),
    });
  }

  public async preview(request: DocumentPdfIngestorExecutionRequest): Promise<DocumentPdfIngestorPreviewResult | DocumentPdfIngestorExecutionFailure> {
    const result = await this.execute(request);
    if (!result.ok) {
      return result;
    }
    return result.preview;
  }
}

export function createDocumentPdfIngestorConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "includePageText",
        label: "Include page text",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.simple,
        defaultValue: true,
      },
      {
        key: "maxPages",
        label: "Max pages",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        min: 1,
      },
      {
        key: "previewPageCount",
        label: "Preview pages",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: 3,
        min: 1,
        max: 10,
      },
      {
        key: "extractMetadata",
        label: "Extract metadata",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
      {
        key: "preservePageBoundaries",
        label: "Preserve page boundaries",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
    ]),
  });
}

export function toDocumentPdfIngestorConfig(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): DocumentPdfIngestorConfig {
  return DocumentPdfIngestorConfigSchema.parse({
    includePageText: typeof config.includePageText === "boolean" ? config.includePageText : true,
    maxPages: typeof config.maxPages === "number" ? config.maxPages : undefined,
    previewPageCount: typeof config.previewPageCount === "number" ? config.previewPageCount : 3,
    extractMetadata: typeof config.extractMetadata === "boolean" ? config.extractMetadata : true,
    preservePageBoundaries: typeof config.preservePageBoundaries === "boolean"
      ? config.preservePageBoundaries
      : true,
  });
}

export function createDocumentPdfIngestorDataAsset(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: DocumentPdfIngestorAsset.assetId,
    name: "PDF/Document Ingestor",
    version: DocumentPdfIngestorAsset.assetVersion,
    source: { type: "generated", workflowId: "dataset-studio-ingestors" },
    location: { accessMethod: "virtual", location: "dataset://document-pdf-ingestor" },
    outputShape: createCanonicalTextItemsShape({
      items: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          format: "pdf",
        },
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Document source reference/resolved source plus PDF ingestion configuration.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Canonical text-items produced from PDF/text ingestion with page-aware metadata.",
      },
    },
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: DocumentPdfIngestorAsset.assetVersion,
    },
    semanticMetadata: {
      description: "First-class PDF/document ingestion asset producing canonical text-items.",
      tags: ["dataset", "ingestion", "document", "pdf", "text-items"],
    },
  });
}
