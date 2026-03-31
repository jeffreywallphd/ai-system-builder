/// <reference types="node" />
import { z } from "zod";
import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalDataShape, type CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { DataPreviewEngine, type DataPreviewModel } from "../data-studio/DataPreviewEngine";
import {
  DataConverterCore,
} from "./DataConverterCore";
import {
  DataConverterDiagnosticSeverities,
  DataConverterOperationKinds,
  type DataConverterDiagnostic,
} from "./DataConverterContracts";
import type {
  IngestionFailureEnvelope,
  IngestionPreviewEnvelope,
  IngestionSuccessEnvelope,
} from "./IngestionCanonicalNormalization";
import { buildIngestionPreviewEnvelope } from "./IngestionCanonicalNormalization";
import {
  IngestionExecutionContextSchema,
  IngestionExecutionStatuses,
  IngestionIssueCategories,
  IngestionIssueRecoverabilities,
  createIngestionLineageHook,
  createIngestionLogRecord,
  createIngestionIssue,
  type IngestionLineageHook,
  type IngestionLogRecord,
  type IngestionIssue,
} from "./IngestionContracts";
import {
  CsvIngestorConfigSchema,
} from "./CsvIngestorAsset";
import {
  JsonIngestorConfigSchema,
} from "./JsonIngestorAsset";
import {
  DocumentPdfIngestorAsset,
  DocumentPdfIngestorConfigSchema,
} from "./DocumentPdfIngestorAsset";
import {
  ImageIngestorAsset,
  ImageIngestorConfigSchema,
} from "./ImageIngestorAsset";
import {
  SourceDescriptorKinds,
  SourceLocatorInputAbstraction,
  SourceLocatorIssueCodes,
  type SourceDescriptor,
  type SourceLocatorIssue,
  type SourceLocatorRequest,
  type SourceLocatorResolutionResult,
} from "./SourceLocatorInputAbstraction";
import {
  DataAssetConfigFieldKinds,
  DataAssetConfigFieldVisibilities,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";
import {
  UnifiedIngestionSourceKinds,
  type IUnifiedIngestionSourceTypeDetector,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import { createUnifiedSourceTypeDetectionService } from "./UnifiedSourceTypeDetectionService";

export const BatchIngestionStrategyKinds = Object.freeze({
  routed: "routed",
  selected: "selected",
} as const);

export const BatchIngestorKinds = Object.freeze({
  csv: "csv",
  json: "json",
  documentPdf: "document-pdf",
  image: "image",
} as const);

export type BatchIngestionStrategyKind = typeof BatchIngestionStrategyKinds[keyof typeof BatchIngestionStrategyKinds];
export type BatchIngestorKind = typeof BatchIngestorKinds[keyof typeof BatchIngestorKinds];

export const BatchIngestionItemErrorCodes = Object.freeze({
  invalidSourceReference: "invalid_source_reference",
  unreadableFile: "unreadable_file",
  unsupportedBatchItem: "unsupported_batch_item",
  invalidConfiguration: "invalid_configuration",
  ingestionFailed: "ingestion_failed",
  failFastStopped: "fail_fast_stopped",
} as const);

export type BatchIngestionItemErrorCode = typeof BatchIngestionItemErrorCodes[keyof typeof BatchIngestionItemErrorCodes];

export interface BatchIngestionItemError {
  readonly code: BatchIngestionItemErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface BatchIngestionItemSuccess {
  readonly ok: true;
  readonly source: SourceDescriptor;
  readonly ingestor: BatchIngestorKind;
  readonly output: CanonicalDataShape;
  readonly normalized?: IngestionSuccessEnvelope<CanonicalDataShape>;
  readonly preview: DataPreviewModel;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
}

export interface BatchIngestionItemFailure {
  readonly ok: false;
  readonly source: SourceDescriptor;
  readonly ingestor?: BatchIngestorKind;
  readonly normalized?: IngestionFailureEnvelope;
  readonly normalizedIssue?: IngestionIssue;
  readonly error: BatchIngestionItemError;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
}

export type BatchIngestionItemResult = BatchIngestionItemSuccess | BatchIngestionItemFailure;

export interface BatchIngestionPreviewPayload {
  readonly itemCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly previewedCount: number;
  readonly truncated: boolean;
  readonly items: ReadonlyArray<{
    readonly sourceId: string;
    readonly sourceLabel: string;
    readonly ingestor?: BatchIngestorKind;
    readonly preview?: DataPreviewModel;
    readonly error?: BatchIngestionItemError;
  }>;
  readonly shapeSummary: Readonly<Record<string, number>>;
  readonly normalized: IngestionPreviewEnvelope;
}

export interface BatchIngestionResult {
  readonly strategy: BatchIngestionStrategyKind;
  readonly itemCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly outputs: ReadonlyArray<{
    readonly sourceId: string;
    readonly ingestor: BatchIngestorKind;
    readonly output: CanonicalDataShape;
  }>;
  readonly items: ReadonlyArray<BatchIngestionItemResult>;
  readonly issues: ReadonlyArray<SourceLocatorIssue>;
  readonly warnings: ReadonlyArray<IngestionIssue>;
  readonly preview: BatchIngestionPreviewPayload;
  readonly lineage: IngestionLineageHook;
  readonly logging: {
    readonly batch: IngestionLogRecord;
    readonly items: ReadonlyArray<IngestionLogRecord>;
  };
}

export const BatchIngestionConfigSchema = z.object({
  continueOnError: z.boolean().default(true),
  maxItems: z.number().int().positive().optional(),
  previewItemLimit: z.number().int().positive().max(100).default(10),
  concurrency: z.number().int().positive().max(16).optional(),
});

export const BatchIngestionSharedConfigSchema = z.object({
  csv: CsvIngestorConfigSchema.partial().optional(),
  json: JsonIngestorConfigSchema.partial().optional(),
  documentPdf: DocumentPdfIngestorConfigSchema.partial().optional(),
  image: ImageIngestorConfigSchema.partial().optional(),
});

export const BatchIngestionStrategySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(BatchIngestionStrategyKinds.routed) }),
  z.object({
    kind: z.literal(BatchIngestionStrategyKinds.selected),
    ingestor: z.enum([
      BatchIngestorKinds.csv,
      BatchIngestorKinds.json,
      BatchIngestorKinds.documentPdf,
      BatchIngestorKinds.image,
    ]),
  }),
]);

type BatchIngestionConfig = z.output<typeof BatchIngestionConfigSchema>;
type BatchIngestionSharedConfig = z.output<typeof BatchIngestionSharedConfigSchema>;
type BatchIngestionStrategy = z.output<typeof BatchIngestionStrategySchema>;

interface NodeFsPromisesRuntime {
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

export interface ExecuteBatchIngestionRequest {
  readonly sourceRequest?: SourceLocatorRequest;
  readonly descriptors?: ReadonlyArray<SourceDescriptor>;
  readonly strategy?: BatchIngestionStrategy;
  readonly config?: Partial<BatchIngestionConfig>;
  readonly sharedConfig?: Partial<BatchIngestionSharedConfig>;
}

export interface PreviewBatchIngestionRequest extends ExecuteBatchIngestionRequest {
  readonly previewOnly?: boolean;
}

export const BatchIngestionAssetId = "batch-ingestion-framework";
export const BatchIngestionAssetVersion = "1.0.0";

function normalizeExtension(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function toDiagnosticsFromLocatorIssue(issue: SourceLocatorIssue): DataConverterDiagnostic {
  return Object.freeze({
    code: issue.code,
    severity: DataConverterDiagnosticSeverities.warning,
    message: issue.message,
    details: issue.details,
  });
}

function toBatchIssueCategory(code: BatchIngestionItemErrorCode): IngestionIssue["category"] {
  if (code === BatchIngestionItemErrorCodes.invalidConfiguration) {
    return IngestionIssueCategories.invalidConfiguration;
  }
  if (code === BatchIngestionItemErrorCodes.unsupportedBatchItem) {
    return IngestionIssueCategories.unsupportedSourceType;
  }
  if (code === BatchIngestionItemErrorCodes.invalidSourceReference) {
    return IngestionIssueCategories.sourceNotFound;
  }
  if (code === BatchIngestionItemErrorCodes.unreadableFile) {
    return IngestionIssueCategories.unreadableSource;
  }
  if (code === BatchIngestionItemErrorCodes.ingestionFailed) {
    return IngestionIssueCategories.parseExtractionFailure;
  }
  if (code === BatchIngestionItemErrorCodes.failFastStopped) {
    return IngestionIssueCategories.batchPartialFailure;
  }
  return IngestionIssueCategories.unknownInternalFailure;
}

function toBatchIssueRecoverability(code: BatchIngestionItemErrorCode): IngestionIssue["recoverability"] {
  if (code === BatchIngestionItemErrorCodes.invalidConfiguration) {
    return IngestionIssueRecoverabilities.fixConfig;
  }
  if (
    code === BatchIngestionItemErrorCodes.invalidSourceReference
    || code === BatchIngestionItemErrorCodes.unreadableFile
    || code === BatchIngestionItemErrorCodes.unsupportedBatchItem
  ) {
    return IngestionIssueRecoverabilities.fixSource;
  }
  if (code === BatchIngestionItemErrorCodes.failFastStopped) {
    return IngestionIssueRecoverabilities.partial;
  }
  return IngestionIssueRecoverabilities.retryable;
}

async function mapWithConcurrency<T, TResult>(
  items: ReadonlyArray<T>,
  concurrency: number,
  mapFn: (item: T, index: number) => Promise<TResult>,
): Promise<ReadonlyArray<TResult>> {
  if (items.length === 0) {
    return Object.freeze([]);
  }
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const results: TResult[] = new Array(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) {
        return;
      }
      results[current] = await mapFn(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return Object.freeze(results);
}

function summarizeShapes(items: ReadonlyArray<BatchIngestionItemResult>): Readonly<Record<string, number>> {
  const summary: Record<string, number> = {};
  for (const item of items) {
    if (!item.ok) {
      continue;
    }
    summary[item.output.kind] = (summary[item.output.kind] ?? 0) + 1;
  }
  return Object.freeze(summary);
}

function isTextLikeForCsvJson(extension?: string): boolean {
  return extension === ".csv" || extension === ".json" || extension === ".tsv" || extension === ".txt";
}

function toLineageSourceReference(descriptor: SourceDescriptor): {
  readonly sourceId?: string;
  readonly sourceReference?: string;
  readonly sourceType?: string;
  readonly mediaType?: string;
  readonly fileName?: string;
  readonly batchId?: string;
  readonly batchItemId?: string;
} {
  return Object.freeze({
    sourceId: descriptor.sourceId,
    sourceReference: descriptor.normalizedReference,
    sourceType: descriptor.kind,
    mediaType: descriptor.mediaType,
    fileName: descriptor.displayName,
    batchId: "batch-ingestion",
    batchItemId: descriptor.sourceId,
  });
}

export class BatchIngestionFramework {
  private readonly sourceLocator: SourceLocatorInputAbstraction;
  private readonly converter: DataConverterCore;
  private readonly documentIngestor: DocumentPdfIngestorAsset;
  private readonly imageIngestor: ImageIngestorAsset;
  private readonly previewEngine: DataPreviewEngine;
  private readonly sourceTypeDetector: IUnifiedIngestionSourceTypeDetector;

  constructor(options?: {
    readonly sourceLocator?: SourceLocatorInputAbstraction;
    readonly converter?: DataConverterCore;
    readonly documentIngestor?: DocumentPdfIngestorAsset;
    readonly imageIngestor?: ImageIngestorAsset;
    readonly previewEngine?: DataPreviewEngine;
    readonly sourceTypeDetector?: IUnifiedIngestionSourceTypeDetector;
  }) {
    this.sourceLocator = options?.sourceLocator ?? new SourceLocatorInputAbstraction();
    this.converter = options?.converter ?? new DataConverterCore();
    this.documentIngestor = options?.documentIngestor ?? new DocumentPdfIngestorAsset();
    this.imageIngestor = options?.imageIngestor ?? new ImageIngestorAsset();
    this.previewEngine = options?.previewEngine ?? new DataPreviewEngine();
    this.sourceTypeDetector = options?.sourceTypeDetector ?? createUnifiedSourceTypeDetectionService();
  }

  public async executeBatch(request: ExecuteBatchIngestionRequest): Promise<BatchIngestionResult> {
    return this.runBatch({ ...request, previewOnly: false });
  }

  public async previewBatch(request: PreviewBatchIngestionRequest): Promise<BatchIngestionResult> {
    return this.runBatch({ ...request, previewOnly: true });
  }

  private async runBatch(request: PreviewBatchIngestionRequest): Promise<BatchIngestionResult> {
    const configParsed = BatchIngestionConfigSchema.safeParse(request.config ?? {});
    const sharedConfigParsed = BatchIngestionSharedConfigSchema.safeParse(request.sharedConfig ?? {});
    const strategyParsed = BatchIngestionStrategySchema.safeParse(
      request.strategy ?? { kind: BatchIngestionStrategyKinds.routed },
    );

    if (!configParsed.success || !sharedConfigParsed.success || !strategyParsed.success) {
      const diagnostics: DataConverterDiagnostic[] = [];
      for (const issue of configParsed.success ? [] : configParsed.error.issues) {
        diagnostics.push(Object.freeze({
          code: BatchIngestionItemErrorCodes.invalidConfiguration,
          severity: DataConverterDiagnosticSeverities.error,
          message: issue.message,
          path: issue.path.join("."),
        }));
      }
      for (const issue of sharedConfigParsed.success ? [] : sharedConfigParsed.error.issues) {
        diagnostics.push(Object.freeze({
          code: BatchIngestionItemErrorCodes.invalidConfiguration,
          severity: DataConverterDiagnosticSeverities.error,
          message: issue.message,
          path: issue.path.join("."),
        }));
      }
      for (const issue of strategyParsed.success ? [] : strategyParsed.error.issues) {
        diagnostics.push(Object.freeze({
          code: BatchIngestionItemErrorCodes.invalidConfiguration,
          severity: DataConverterDiagnosticSeverities.error,
          message: issue.message,
          path: issue.path.join("."),
        }));
      }

      const invalidConfigIssue = createIngestionIssue({
        code: BatchIngestionItemErrorCodes.invalidConfiguration,
        message: diagnostics[0]?.message ?? "Invalid batch ingestion configuration.",
        category: IngestionIssueCategories.invalidConfiguration,
        recoverability: IngestionIssueRecoverabilities.fixConfig,
        source: {
          sourceReference: "batch",
        },
      });
      const previewContext = IngestionExecutionContextSchema.parse({
        executionMode: "preview",
        sourceReference: "batch",
      });
      return Object.freeze({
        strategy: BatchIngestionStrategyKinds.routed,
        itemCount: 0,
        successCount: 0,
        failureCount: 1,
        outputs: Object.freeze([]),
        items: Object.freeze([
          Object.freeze({
            ok: false,
            source: Object.freeze({
              sourceId: "invalid-config",
              kind: SourceDescriptorKinds.remoteFile,
              originalReference: "batch",
              normalizedReference: "batch",
              sourceType: "file",
              displayName: "batch",
            }),
            error: Object.freeze({
              code: BatchIngestionItemErrorCodes.invalidConfiguration,
              message: diagnostics[0]?.message ?? "Invalid batch ingestion configuration.",
            }),
            normalizedIssue: invalidConfigIssue,
            diagnostics: Object.freeze(diagnostics),
          } satisfies BatchIngestionItemFailure),
        ]),
        issues: Object.freeze([]),
        warnings: Object.freeze([]),
        preview: Object.freeze({
          itemCount: 0,
          successCount: 0,
          failureCount: 1,
          previewedCount: 1,
          truncated: false,
          items: Object.freeze([
            Object.freeze({
              sourceId: "invalid-config",
              sourceLabel: "batch",
              error: Object.freeze({
                code: BatchIngestionItemErrorCodes.invalidConfiguration,
                message: diagnostics[0]?.message ?? "Invalid batch ingestion configuration.",
              }),
            }),
          ]),
          shapeSummary: Object.freeze({}),
          normalized: buildIngestionPreviewEnvelope({
            ingestor: "batch-ingestion-framework",
            context: previewContext,
            asset: Object.freeze({
              assetId: BatchIngestionAssetId,
              assetVersion: BatchIngestionAssetVersion,
            }),
            configSummary: Object.freeze({
              config: request.config ?? {},
              strategy: request.strategy ?? { kind: BatchIngestionStrategyKinds.routed },
            }),
            totalCount: 1,
            sampleCount: 1,
            sourceCount: 1,
            successCount: 0,
            failureCount: 1,
            preview: this.previewEngine.buildFromCanonicalShape({
              kind: "records",
              records: Object.freeze([]),
              metadata: { schemaVersion: "1.0.0" },
            }),
            issues: Object.freeze([invalidConfigIssue]),
          }),
        }),
        lineage: createIngestionLineageHook({
          producer: Object.freeze({
            assetId: BatchIngestionAssetId,
            assetVersion: BatchIngestionAssetVersion,
          }),
          executionMode: "preview",
          sources: Object.freeze([]),
          output: Object.freeze({
            shapeKind: "records",
            totalCount: 1,
            sourceCount: 1,
            successCount: 0,
            failureCount: 1,
          }),
          configSummary: Object.freeze({
            config: request.config ?? {},
            strategy: request.strategy ?? { kind: BatchIngestionStrategyKinds.routed },
          }),
        }),
        logging: Object.freeze({
          batch: createIngestionLogRecord({
            executionMode: "preview",
            status: IngestionExecutionStatuses.failed,
            asset: Object.freeze({
              assetId: BatchIngestionAssetId,
              assetVersion: BatchIngestionAssetVersion,
            }),
            issues: Object.freeze([invalidConfigIssue]),
            outputSummary: Object.freeze({
              shapeKind: "records",
              totalCount: 1,
              sourceCount: 1,
              successCount: 0,
              failureCount: 1,
            }),
            configSummary: Object.freeze({
              config: request.config ?? {},
              strategy: request.strategy ?? { kind: BatchIngestionStrategyKinds.routed },
            }),
          }),
          items: Object.freeze([]),
        }),
      });
    }

    const strategy = strategyParsed.data;
    const config = configParsed.data;
    const sharedConfig = sharedConfigParsed.data;

    const sourceResolution = await this.resolveSources(request);
    const sourceIssues = sourceResolution.issues;

    const eligibleDescriptors = config.maxItems
      ? sourceResolution.descriptors.slice(0, config.maxItems)
      : sourceResolution.descriptors;

    const shouldProcess = request.previewOnly
      ? eligibleDescriptors.slice(0, Math.min(config.previewItemLimit, eligibleDescriptors.length))
      : eligibleDescriptors;

    const runConcurrency = request.previewOnly || !config.continueOnError
      ? 1
      : (config.concurrency ?? 1);

    let failFastTriggered = false;
    const items = await mapWithConcurrency(shouldProcess, runConcurrency, async (descriptor, index) => {
      if (failFastTriggered) {
        const failFastIssue = createIngestionIssue({
          code: BatchIngestionItemErrorCodes.failFastStopped,
          message: "Item was not processed because fail-fast mode stopped the batch.",
          category: toBatchIssueCategory(BatchIngestionItemErrorCodes.failFastStopped),
          recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.failFastStopped),
          severity: "warning",
          source: {
            sourceId: descriptor.sourceId,
            sourceReference: descriptor.normalizedReference,
            fileName: descriptor.displayName,
          },
        });
        return Object.freeze({
          ok: false,
          source: descriptor,
          error: Object.freeze({
            code: BatchIngestionItemErrorCodes.failFastStopped,
            message: "Item was not processed because fail-fast mode stopped the batch.",
          }),
          normalizedIssue: failFastIssue,
          diagnostics: Object.freeze([]),
        } satisfies BatchIngestionItemFailure);
      }

      const item = await this.processDescriptor(descriptor, strategy, sharedConfig, config.previewItemLimit);
      if (!item.ok && !config.continueOnError) {
        failFastTriggered = true;
      }
      return item;
    });

    const combinedItems: BatchIngestionItemResult[] = [...items];
    for (const issue of sourceIssues) {
      const mappedCode = issue.code === SourceLocatorIssueCodes.unsupportedExtension
        ? BatchIngestionItemErrorCodes.unsupportedBatchItem
        : issue.code === SourceLocatorIssueCodes.unreadablePath
          ? BatchIngestionItemErrorCodes.unreadableFile
          : BatchIngestionItemErrorCodes.invalidSourceReference;
      combinedItems.push(Object.freeze({
        ok: false,
        source: Object.freeze({
          sourceId: `source-issue-${combinedItems.length + 1}`,
          kind: SourceDescriptorKinds.remoteFile,
          originalReference: issue.reference ?? "unknown",
          normalizedReference: issue.reference ?? "unknown",
          sourceType: "file",
          displayName: issue.reference ?? "unknown",
        }),
        error: Object.freeze({
          code: mappedCode,
          message: issue.message,
        }),
        normalizedIssue: createIngestionIssue({
          code: mappedCode,
          message: issue.message,
          category: toBatchIssueCategory(mappedCode),
          recoverability: toBatchIssueRecoverability(mappedCode),
          source: {
            sourceReference: issue.reference,
          },
        }),
        diagnostics: Object.freeze([toDiagnosticsFromLocatorIssue(issue)]),
      } satisfies BatchIngestionItemFailure));
    }

    const successItems = combinedItems.filter((item): item is BatchIngestionItemSuccess => item.ok);
    const failureItems = combinedItems.filter((item) => !item.ok);
    const outputs = Object.freeze(successItems.map((item) => Object.freeze({
      sourceId: item.source.sourceId,
      ingestor: item.ingestor,
      output: item.output,
    })));

    const previewItems = combinedItems.slice(0, config.previewItemLimit);
    const batchWarnings: IngestionIssue[] = [];
    if (previewItems.length < combinedItems.length) {
      batchWarnings.push(createIngestionIssue({
        code: "batch-preview-truncated",
        message: "Batch preview was truncated to keep preview execution bounded.",
        category: IngestionIssueCategories.batchPartialFailure,
        severity: "warning",
        recoverability: IngestionIssueRecoverabilities.partial,
        details: Object.freeze({
          totalCount: combinedItems.length,
          sampleCount: previewItems.length,
          previewItemLimit: config.previewItemLimit,
        }),
      }));
    }
    if (failureItems.length > 0 && successItems.length > 0) {
      batchWarnings.push(createIngestionIssue({
        code: "batch-partial-failure",
        message: "Batch ingestion completed with mixed success/failure outcomes.",
        category: IngestionIssueCategories.batchPartialFailure,
        severity: "warning",
        recoverability: IngestionIssueRecoverabilities.partial,
        details: Object.freeze({
          successCount: successItems.length,
          failureCount: failureItems.length,
        }),
      }));
    }
    const previewContext = IngestionExecutionContextSchema.parse({
      executionMode: request.previewOnly ? "preview" : "execute",
      batchId: "batch-ingestion",
    });
    const preview = Object.freeze({
      itemCount: combinedItems.length,
      successCount: successItems.length,
      failureCount: failureItems.length,
      previewedCount: previewItems.length,
      truncated: previewItems.length < combinedItems.length,
      items: Object.freeze(previewItems.map((item) => Object.freeze({
        sourceId: item.source.sourceId,
        sourceLabel: item.source.displayName,
        ingestor: item.ok ? item.ingestor : item.ingestor,
        preview: item.ok ? item.preview : undefined,
        error: item.ok ? undefined : item.error,
      }))),
      shapeSummary: summarizeShapes(combinedItems),
      normalized: buildIngestionPreviewEnvelope({
        ingestor: "batch-ingestion-framework",
        context: previewContext,
        asset: Object.freeze({
          assetId: BatchIngestionAssetId,
          assetVersion: BatchIngestionAssetVersion,
        }),
        configSummary: Object.freeze({
          strategy: strategy.kind,
          config,
          sharedConfig,
        }),
        sourceReferences: Object.freeze(combinedItems.map((entry) => toLineageSourceReference(entry.source))),
        totalCount: combinedItems.length,
        sampleCount: previewItems.length,
        sourceCount: combinedItems.length,
        successCount: successItems.length,
        failureCount: failureItems.length,
        childExecutionIds: Object.freeze(
          combinedItems.map((item) => `batch-item-${item.source.sourceId}`),
        ),
        preview: this.previewEngine.buildFromCanonicalShape({
          kind: "records",
          records: Object.freeze(previewItems.map((item, index) => Object.freeze({
            recordId: `batch-preview-${index + 1}`,
            fields: Object.freeze({
              sourceId: item.source.sourceId,
              sourceLabel: item.source.displayName,
              ingestor: item.ok ? item.ingestor : item.ingestor ?? null,
              status: item.ok ? "succeeded" : "failed",
            }),
          }))),
          metadata: { schemaVersion: "1.0.0" },
        }),
        issues: Object.freeze([
          ...batchWarnings,
          ...failureItems
            .map((item) => item.normalizedIssue)
            .filter((issue): issue is IngestionIssue => Boolean(issue))
            .slice(0, config.previewItemLimit),
        ]),
      }),
    } satisfies BatchIngestionPreviewPayload);

    const itemLogs = Object.freeze(combinedItems.map((item) => {
      if (item.ok && item.normalized?.log) {
        return item.normalized.log;
      }
      if (!item.ok && item.normalized?.log) {
        return item.normalized.log;
      }

      const itemIssue = !item.ok
        ? item.normalizedIssue ?? createIngestionIssue({
          code: item.error.code,
          message: item.error.message,
          category: toBatchIssueCategory(item.error.code),
          recoverability: toBatchIssueRecoverability(item.error.code),
          source: {
            sourceId: item.source.sourceId,
            sourceReference: item.source.normalizedReference,
            fileName: item.source.displayName,
            batchId: "batch-ingestion",
            batchItemId: item.source.sourceId,
          },
        })
        : undefined;
      return createIngestionLogRecord({
        executionMode: request.previewOnly ? "preview" : "execute",
        status: item.ok ? IngestionExecutionStatuses.succeeded : IngestionExecutionStatuses.failed,
        asset: Object.freeze({
          assetId: item.ingestor ? `${item.ingestor}-ingestor` : BatchIngestionAssetId,
          assetVersion: "1.0.0",
        }),
        issues: itemIssue ? Object.freeze([itemIssue]) : Object.freeze([]),
        outputSummary: item.ok
          ? Object.freeze({
            shapeKind: item.output.kind,
            totalCount: item.output.kind === "records"
              ? item.output.records.length
              : item.output.kind === "table"
                ? item.output.rows.length
              : item.output.kind === "text-items"
                ? item.output.items.length
                : item.output.items.length,
          })
          : Object.freeze({
            shapeKind: "records",
            totalCount: 0,
          }),
        sources: Object.freeze([toLineageSourceReference(item.source)]),
        configSummary: Object.freeze({
          strategy: strategy.kind,
          ingestor: item.ingestor,
          previewOnly: request.previewOnly === true,
        }),
        executionId: `batch-item-${item.source.sourceId}`,
        runId: "batch-ingestion",
      });
    }));

    const lineage = preview.normalized.lineage;
    const batchLog = preview.normalized.log;

    return Object.freeze({
      strategy: strategy.kind,
      itemCount: combinedItems.length,
      successCount: successItems.length,
      failureCount: failureItems.length,
      outputs,
      items: Object.freeze(combinedItems),
      issues: Object.freeze(sourceIssues),
      warnings: Object.freeze(batchWarnings),
      preview,
      lineage,
      logging: Object.freeze({
        batch: batchLog,
        items: itemLogs,
      }),
    } satisfies BatchIngestionResult);
  }

  private async resolveSources(request: ExecuteBatchIngestionRequest): Promise<SourceLocatorResolutionResult> {
    if (request.descriptors) {
      const descriptors = Object.freeze([...request.descriptors]);
      return Object.freeze({
        descriptors,
        issues: Object.freeze([]),
        extensionSummary: Object.freeze({}),
      });
    }

    if (!request.sourceRequest) {
      return Object.freeze({
        descriptors: Object.freeze([]),
        issues: Object.freeze([Object.freeze({
          code: SourceLocatorIssueCodes.invalidReference,
          message: "Batch ingestion requires either descriptors or a sourceRequest.",
        })]),
        extensionSummary: Object.freeze({}),
      });
    }

    return this.sourceLocator.resolve(request.sourceRequest);
  }

  private async processDescriptor(
    descriptor: SourceDescriptor,
    strategy: BatchIngestionStrategy,
    sharedConfig: BatchIngestionSharedConfig,
    previewItemLimit: number,
  ): Promise<BatchIngestionItemResult> {
    if (descriptor.kind !== SourceDescriptorKinds.localFile) {
      const invalidRefIssue = createIngestionIssue({
        code: BatchIngestionItemErrorCodes.invalidSourceReference,
        message: "Only local-file descriptors are currently executable for batch ingestion.",
        category: toBatchIssueCategory(BatchIngestionItemErrorCodes.invalidSourceReference),
        recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.invalidSourceReference),
        source: {
          sourceId: descriptor.sourceId,
          sourceReference: descriptor.normalizedReference,
          fileName: descriptor.displayName,
        },
      });
      return Object.freeze({
        ok: false,
        source: descriptor,
        error: Object.freeze({
          code: BatchIngestionItemErrorCodes.invalidSourceReference,
          message: "Only local-file descriptors are currently executable for batch ingestion.",
        }),
        normalizedIssue: invalidRefIssue,
        diagnostics: Object.freeze([]),
      });
    }

    let payload: string | Uint8Array;
    try {
      payload = await this.readPayload(descriptor);
    } catch (error) {
      const unreadableIssue = createIngestionIssue({
        code: BatchIngestionItemErrorCodes.unreadableFile,
        message: `Unable to read source file '${descriptor.normalizedReference}'.`,
        category: toBatchIssueCategory(BatchIngestionItemErrorCodes.unreadableFile),
        recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.unreadableFile),
        source: {
          sourceId: descriptor.sourceId,
          sourceReference: descriptor.normalizedReference,
          fileName: descriptor.displayName,
        },
      });
      return Object.freeze({
        ok: false,
        source: descriptor,
        error: Object.freeze({
          code: BatchIngestionItemErrorCodes.unreadableFile,
          message: `Unable to read source file '${descriptor.normalizedReference}'.`,
          details: Object.freeze({
            cause: error instanceof Error ? error.message : String(error),
          }),
        }),
        normalizedIssue: unreadableIssue,
        diagnostics: Object.freeze([]),
      });
    }

    const ingestor = strategy.kind === BatchIngestionStrategyKinds.selected
      ? strategy.ingestor
      : await this.detectRoutedIngestor(descriptor, payload);

    if (!ingestor) {
      const unsupportedIssue = createIngestionIssue({
        code: BatchIngestionItemErrorCodes.unsupportedBatchItem,
        message: `Unable to route source '${descriptor.displayName}' to a supported ingestor.`,
        category: toBatchIssueCategory(BatchIngestionItemErrorCodes.unsupportedBatchItem),
        recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.unsupportedBatchItem),
        source: {
          sourceId: descriptor.sourceId,
          sourceReference: descriptor.normalizedReference,
          fileName: descriptor.displayName,
        },
      });
      return Object.freeze({
        ok: false,
        source: descriptor,
        error: Object.freeze({
          code: BatchIngestionItemErrorCodes.unsupportedBatchItem,
          message: `Unable to route source '${descriptor.displayName}' to a supported ingestor.`,
          details: Object.freeze({
            extension: descriptor.extension,
            mediaType: descriptor.mediaType,
          }),
        }),
        normalizedIssue: unsupportedIssue,
        diagnostics: Object.freeze([]),
      });
    }

    if ((ingestor === BatchIngestorKinds.csv || ingestor === BatchIngestorKinds.json) && !isTextLikeForCsvJson(descriptor.extension)) {
      const unsupportedByIngestorIssue = createIngestionIssue({
        code: BatchIngestionItemErrorCodes.unsupportedBatchItem,
        message: `Ingestor '${ingestor}' does not support source '${descriptor.displayName}'.`,
        category: toBatchIssueCategory(BatchIngestionItemErrorCodes.unsupportedBatchItem),
        recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.unsupportedBatchItem),
        source: {
          sourceId: descriptor.sourceId,
          sourceReference: descriptor.normalizedReference,
          fileName: descriptor.displayName,
        },
      });
      return Object.freeze({
        ok: false,
        source: descriptor,
        ingestor,
        error: Object.freeze({
          code: BatchIngestionItemErrorCodes.unsupportedBatchItem,
          message: `Ingestor '${ingestor}' does not support source '${descriptor.displayName}'.`,
        }),
        normalizedIssue: unsupportedByIngestorIssue,
        diagnostics: Object.freeze([]),
      });
    }

    if (ingestor === BatchIngestorKinds.csv || ingestor === BatchIngestorKinds.json) {
      const conversion = this.converter.convert({
        operation: DataConverterOperationKinds.sourceToRecords,
        source: {
          kind: "local-file",
          reference: descriptor.normalizedReference,
          sourceId: descriptor.sourceId,
          payload,
          fileName: descriptor.displayName,
          contentType: descriptor.mediaType,
          groupId: descriptor.groupId,
          formatHint: ingestor === BatchIngestorKinds.csv ? "csv" : "json",
          diagnostics: Object.freeze([]),
        },
        ...(ingestor === BatchIngestorKinds.csv ? sharedConfig.csv : sharedConfig.json),
      });

      if (!conversion.ok) {
        const ingestionFailedIssue = createIngestionIssue({
          code: BatchIngestionItemErrorCodes.ingestionFailed,
          message: conversion.diagnostics[0]?.message ?? `Ingestion failed for ${descriptor.displayName}.`,
          category: toBatchIssueCategory(BatchIngestionItemErrorCodes.ingestionFailed),
          recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.ingestionFailed),
          source: {
            sourceId: descriptor.sourceId,
            sourceReference: descriptor.normalizedReference,
            fileName: descriptor.displayName,
          },
        });
        return Object.freeze({
          ok: false,
          source: descriptor,
          ingestor,
          error: Object.freeze({
            code: BatchIngestionItemErrorCodes.ingestionFailed,
            message: conversion.diagnostics[0]?.message ?? `Ingestion failed for ${descriptor.displayName}.`,
          }),
          normalizedIssue: ingestionFailedIssue,
          diagnostics: conversion.diagnostics,
        });
      }

      const preview = this.previewEngine.buildFromCanonicalShape(conversion.output, {
        maxItems: Math.max(1, previewItemLimit),
        maxColumns: 12,
        maxTextLength: 220,
      }, conversion.diagnostics);
      return Object.freeze({
        ok: true,
        source: descriptor,
        ingestor,
        output: conversion.output,
        normalized: undefined,
        preview,
        diagnostics: conversion.diagnostics,
      });
    }

    if (ingestor === BatchIngestorKinds.documentPdf) {
      const documentResult = await this.documentIngestor.execute({
        source: {
          kind: "local-file",
          reference: descriptor.normalizedReference,
          payload,
          fileName: descriptor.displayName,
          contentType: descriptor.mediaType,
          diagnostics: Object.freeze([]),
        },
        config: sharedConfig.documentPdf,
        context: {
          executionMode: "execute",
          sourceId: descriptor.sourceId,
          sourceReference: descriptor.normalizedReference,
          fileName: descriptor.displayName,
          contentType: descriptor.mediaType,
          groupId: descriptor.groupId,
          batchId: "batch-ingestion",
          batchItemId: descriptor.sourceId,
        },
      });

      if (!documentResult.ok) {
        const ingestionFailedIssue = createIngestionIssue({
          code: BatchIngestionItemErrorCodes.ingestionFailed,
          message: documentResult.diagnostics[0]?.message ?? `Ingestion failed for ${descriptor.displayName}.`,
          category: toBatchIssueCategory(BatchIngestionItemErrorCodes.ingestionFailed),
          recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.ingestionFailed),
          source: {
            sourceId: descriptor.sourceId,
            sourceReference: descriptor.normalizedReference,
            fileName: descriptor.displayName,
          },
        });
        return Object.freeze({
          ok: false,
          source: descriptor,
          ingestor,
          error: Object.freeze({
            code: BatchIngestionItemErrorCodes.ingestionFailed,
            message: documentResult.diagnostics[0]?.message ?? `Ingestion failed for ${descriptor.displayName}.`,
          }),
          normalizedIssue: ingestionFailedIssue,
          diagnostics: Object.freeze(documentResult.diagnostics.map((entry) => Object.freeze({
            code: entry.code,
            severity: DataConverterDiagnosticSeverities.error,
            message: entry.message,
            path: entry.path,
            details: entry.details,
          }))),
        });
      }

      return Object.freeze({
        ok: true,
        source: descriptor,
        ingestor,
        output: documentResult.output,
        normalized: documentResult.normalized as IngestionSuccessEnvelope<CanonicalDataShape>,
        preview: this.previewEngine.buildFromCanonicalShape(documentResult.output, {
          maxItems: Math.max(1, previewItemLimit),
          maxColumns: 8,
          maxTextLength: 220,
        }),
        diagnostics: Object.freeze([]),
      });
    }

    const imageResult = await this.imageIngestor.execute({
      source: {
        kind: "local-file",
        reference: descriptor.normalizedReference,
        payload,
        fileName: descriptor.displayName,
        contentType: descriptor.mediaType,
        diagnostics: Object.freeze([]),
      },
      config: sharedConfig.image,
      context: {
        executionMode: "execute",
        sourceId: descriptor.sourceId,
        sourceReference: descriptor.normalizedReference,
        fileName: descriptor.displayName,
        contentType: descriptor.mediaType,
        groupId: descriptor.groupId,
        batchId: "batch-ingestion",
        batchItemId: descriptor.sourceId,
      },
    });

    if (!imageResult.ok) {
      const ingestionFailedIssue = createIngestionIssue({
        code: BatchIngestionItemErrorCodes.ingestionFailed,
        message: imageResult.diagnostics[0]?.message ?? `Ingestion failed for ${descriptor.displayName}.`,
        category: toBatchIssueCategory(BatchIngestionItemErrorCodes.ingestionFailed),
        recoverability: toBatchIssueRecoverability(BatchIngestionItemErrorCodes.ingestionFailed),
        source: {
          sourceId: descriptor.sourceId,
          sourceReference: descriptor.normalizedReference,
          fileName: descriptor.displayName,
        },
      });
      return Object.freeze({
        ok: false,
        source: descriptor,
        ingestor,
        error: Object.freeze({
          code: BatchIngestionItemErrorCodes.ingestionFailed,
          message: imageResult.diagnostics[0]?.message ?? `Ingestion failed for ${descriptor.displayName}.`,
        }),
        normalizedIssue: ingestionFailedIssue,
        diagnostics: Object.freeze(imageResult.diagnostics.map((entry) => Object.freeze({
          code: entry.code,
          severity: DataConverterDiagnosticSeverities.error,
          message: entry.message,
          path: entry.path,
          details: entry.details,
        }))),
      });
    }

    return Object.freeze({
      ok: true,
      source: descriptor,
      ingestor,
      output: imageResult.output,
      normalized: imageResult.normalized as IngestionSuccessEnvelope<CanonicalDataShape>,
      preview: this.previewEngine.buildFromCanonicalShape(imageResult.output, {
        maxItems: Math.max(1, previewItemLimit),
        maxColumns: 8,
        maxTextLength: 220,
      }),
      diagnostics: Object.freeze([]),
    });
  }

  private async readPayload(descriptor: SourceDescriptor): Promise<string | Uint8Array> {
    let fsPromises: NodeFsPromisesRuntime;
    try {
      const fsModule = await import("node:fs");
      if (!fsModule.promises) {
        throw new Error("Node filesystem promises API is unavailable.");
      }
      fsPromises = fsModule.promises as NodeFsPromisesRuntime;
    } catch (error) {
      throw new Error(
        `Local source execution requires a Node.js filesystem runtime (${error instanceof Error ? error.message : String(error)}).`,
      );
    }

    const extension = normalizeExtension(descriptor.extension);
    const binary = extension === ".pdf"
      || extension === ".png"
      || extension === ".jpg"
      || extension === ".jpeg"
      || extension === ".webp";
    if (binary) {
      const content = await fsPromises.readFile(descriptor.normalizedReference);
      return new Uint8Array(content);
    }
    return fsPromises.readFile(descriptor.normalizedReference, "utf-8");
  }

  private async detectRoutedIngestor(
    descriptor: SourceDescriptor,
    payload: string | Uint8Array,
  ): Promise<BatchIngestorKind | undefined> {
    const detection = await this.sourceTypeDetector.detect({
      source: {
        sourceId: descriptor.sourceId,
        referenceKind: descriptor.kind === SourceDescriptorKinds.localFile ? "local-path" : "remote-url",
        reference: descriptor.normalizedReference,
        displayName: descriptor.displayName,
        extension: descriptor.extension,
        mimeType: descriptor.mediaType,
        sizeInBytes: descriptor.sizeInBytes,
        groupId: descriptor.groupId,
      },
      payload,
      enableContentSniffing: true,
    });

    if (detection.detectedKind === UnifiedIngestionSourceKinds.csv) {
      return BatchIngestorKinds.csv;
    }
    if (detection.detectedKind === UnifiedIngestionSourceKinds.json) {
      return BatchIngestorKinds.json;
    }
    if (detection.detectedKind === UnifiedIngestionSourceKinds.document) {
      return BatchIngestorKinds.documentPdf;
    }
    if (detection.detectedKind === UnifiedIngestionSourceKinds.image) {
      return BatchIngestorKinds.image;
    }
    return undefined;
  }
}

export function createBatchIngestionConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "continueOnError",
        label: "Continue on error",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.simple,
        defaultValue: true,
      },
      {
        key: "maxItems",
        label: "Max items",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.simple,
        min: 1,
      },
      {
        key: "previewItemLimit",
        label: "Preview item limit",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: 10,
        min: 1,
        max: 100,
      },
      {
        key: "concurrency",
        label: "Concurrency",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        min: 1,
        max: 16,
      },
      {
        key: "strategy",
        label: "Strategy",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.simple,
        defaultValue: BatchIngestionStrategyKinds.routed,
        options: Object.freeze([
          { value: BatchIngestionStrategyKinds.routed, label: "Auto route by source type" },
          { value: BatchIngestionStrategyKinds.selected, label: "Use one ingestor" },
        ]),
      },
      {
        key: "selectedIngestor",
        label: "Selected ingestor",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: BatchIngestorKinds.csv,
        options: Object.freeze([
          { value: BatchIngestorKinds.csv, label: "CSV" },
          { value: BatchIngestorKinds.json, label: "JSON" },
          { value: BatchIngestorKinds.documentPdf, label: "Document/PDF" },
          { value: BatchIngestorKinds.image, label: "Image" },
        ]),
      },
    ]),
  });
}

export function createBatchIngestionDataAsset(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: BatchIngestionAssetId,
    name: "Batch Ingestion Framework",
    version: BatchIngestionAssetVersion,
    source: { type: "generated", workflowId: "dataset-studio-ingestors" },
    location: { accessMethod: "virtual", location: "dataset://batch-ingestion-framework" },
    outputShape: createCanonicalRecordsShape({
      records: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          format: "batch-ingestion",
        },
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Source locator requests plus strategy/shared batch ingestion configuration.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Batch summary records and canonical outputs from routed ingestion.",
      },
    },
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: BatchIngestionAssetVersion,
    },
    semanticMetadata: {
      description: "First-class batch ingestion asset for mixed-source ingestion preview and execution.",
      tags: ["dataset", "ingestion", "batch", "orchestration"],
    },
  });
}
