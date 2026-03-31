import { DataPreviewEngine, type DataPreviewModel } from "../data-studio/DataPreviewEngine";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTextItemsShape,
  type CanonicalDataMetadata,
  type CanonicalDataShape,
  type CanonicalImageMetadataRecordsShape,
  type CanonicalRecordValue,
  type CanonicalRecordsShape,
  type CanonicalTextItemsShape,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import type { IngestionExecutionContext, IngestionIssue } from "./IngestionContracts";

export interface IngestionMetadataContext extends IngestionExecutionContext {
  readonly formatHint?: string;
}

export interface IngestionSuccessEnvelope<TOutput extends CanonicalDataShape> {
  readonly contractVersion: "1.0.0";
  readonly ok: true;
  readonly output: TOutput;
  readonly preview: DataPreviewModel;
  readonly issues: ReadonlyArray<IngestionIssue>;
  readonly context: IngestionExecutionContext;
}

export interface IngestionFailureEnvelope {
  readonly contractVersion: "1.0.0";
  readonly ok: false;
  readonly issues: ReadonlyArray<IngestionIssue>;
  readonly context: IngestionExecutionContext;
}

export interface IngestionPreviewEnvelope {
  readonly contractVersion: "1.0.0";
  readonly ingestor: string;
  readonly ok: boolean;
  readonly context: IngestionExecutionContext;
  readonly source: {
    readonly sourceId?: string;
    readonly sourceReference?: string;
    readonly fileName?: string;
    readonly contentType?: string;
    readonly format?: string;
  };
  readonly summary: {
    readonly totalCount: number;
    readonly sampleCount: number;
    readonly truncated: boolean;
    readonly sourceCount?: number;
    readonly successCount?: number;
    readonly failureCount?: number;
  };
  readonly preview: DataPreviewModel;
  readonly sample?: ReadonlyArray<unknown>;
  readonly schema?: ReadonlyArray<{
    readonly name: string;
    readonly valueType: string;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly issues: ReadonlyArray<IngestionIssue>;
  readonly partialFailures?: ReadonlyArray<{
    readonly sourceId?: string;
    readonly sourceReference?: string;
    readonly issue: IngestionIssue;
  }>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toCanonicalRecordValue(value: unknown): CanonicalRecordValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
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

function mergeIngestionMetadata(
  metadata: CanonicalDataMetadata | undefined,
  context: IngestionMetadataContext,
): Partial<CanonicalDataMetadata> {
  const sourceAssetId = normalizeOptional(context.sourceAssetId);
  const sourceVersionId = normalizeOptional(context.sourceVersionId);
  const mergedAttributes = Object.fromEntries(
    Object.entries({
      ...(metadata?.attributes ?? {}),
      sourceId: normalizeOptional(context.sourceId),
      sourceReference: normalizeOptional(context.sourceReference),
      groupId: normalizeOptional(context.groupId),
      batchId: normalizeOptional(context.batchId),
      batchItemId: normalizeOptional(context.batchItemId),
    }).filter(([, value]) => value !== undefined),
  ) as Readonly<Record<string, CanonicalRecordValue>>;

  return Object.freeze({
    ...metadata,
    source: Object.freeze({
      ...(metadata?.source ?? {}),
      fileName: normalizeOptional(context.fileName) ?? metadata?.source?.fileName,
      contentType: normalizeOptional(context.contentType ?? context.mediaType) ?? metadata?.source?.contentType,
      format: normalizeOptional(context.formatHint) ?? metadata?.source?.format,
    }),
    lineage: sourceAssetId
      ? Object.freeze([Object.freeze({
        assetId: sourceAssetId,
        versionId: sourceVersionId,
        relationship: "source" as const,
      })])
      : metadata?.lineage,
    attributes: Object.freeze(mergedAttributes),
  });
}

export function normalizeRecordsOutput(input: {
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly context: IngestionMetadataContext;
  readonly metadata?: CanonicalDataMetadata;
  readonly recordIdPrefix?: string;
}): CanonicalRecordsShape {
  const prefix = normalizeOptional(input.recordIdPrefix) ?? "record";
  return createCanonicalRecordsShape({
    records: Object.freeze(input.records.map((record, index) => Object.freeze({
      recordId: `${prefix}-${index + 1}`,
      fields: Object.freeze(Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key, toCanonicalRecordValue(value)]),
      )),
    }))),
    metadata: mergeIngestionMetadata(input.metadata, input.context),
  });
}

export function normalizeDocumentTextItemsOutput(input: {
  readonly output: CanonicalTextItemsShape;
  readonly context: IngestionMetadataContext;
  readonly additionalAttributes?: Readonly<Record<string, unknown>>;
}): CanonicalTextItemsShape {
  const attributes = Object.freeze({
    ...(input.output.metadata.attributes ?? {}),
    ...(input.additionalAttributes ?? {}),
  });
  return createCanonicalTextItemsShape({
    items: input.output.items,
    metadata: Object.freeze({
      ...mergeIngestionMetadata(input.output.metadata, input.context),
      attributes: Object.freeze(Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, toCanonicalRecordValue(value)]),
      )),
    }),
  });
}

export function normalizeImageMetadataOutput(input: {
  readonly output: CanonicalImageMetadataRecordsShape;
  readonly context: IngestionMetadataContext;
  readonly additionalAttributes?: Readonly<Record<string, unknown>>;
}): CanonicalImageMetadataRecordsShape {
  const attributes = Object.freeze({
    ...(input.output.metadata.attributes ?? {}),
    ...(input.additionalAttributes ?? {}),
  });
  return createCanonicalImageMetadataRecordsShape({
    items: input.output.items,
    metadata: Object.freeze({
      ...mergeIngestionMetadata(input.output.metadata, input.context),
      attributes: Object.freeze(Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, toCanonicalRecordValue(value)]),
      )),
    }),
  });
}

const previewEngine = new DataPreviewEngine();

export function buildIngestionSuccessEnvelope<TOutput extends CanonicalDataShape>(input: {
  readonly output: TOutput;
  readonly context: IngestionExecutionContext;
  readonly issues?: ReadonlyArray<IngestionIssue>;
}): IngestionSuccessEnvelope<TOutput> {
  return Object.freeze({
    contractVersion: "1.0.0",
    ok: true,
    output: input.output,
    preview: previewEngine.buildFromCanonicalShape(input.output),
    issues: input.issues ?? Object.freeze([]),
    context: input.context,
  });
}

export function buildIngestionFailureEnvelope(input: {
  readonly context: IngestionExecutionContext;
  readonly issues: ReadonlyArray<IngestionIssue>;
}): IngestionFailureEnvelope {
  return Object.freeze({
    contractVersion: "1.0.0",
    ok: false,
    issues: input.issues,
    context: input.context,
  });
}

export function buildIngestionPreviewEnvelope(input: {
  readonly ingestor: string;
  readonly context: IngestionExecutionContext;
  readonly totalCount: number;
  readonly sampleCount: number;
  readonly preview: DataPreviewModel;
  readonly sourceCount?: number;
  readonly successCount?: number;
  readonly failureCount?: number;
  readonly sample?: ReadonlyArray<unknown>;
  readonly schema?: ReadonlyArray<{
    readonly name: string;
    readonly valueType: string;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly issues?: ReadonlyArray<IngestionIssue>;
  readonly partialFailures?: ReadonlyArray<{
    readonly sourceId?: string;
    readonly sourceReference?: string;
    readonly issue: IngestionIssue;
  }>;
}): IngestionPreviewEnvelope {
  return Object.freeze({
    contractVersion: "1.0.0",
    ingestor: input.ingestor,
    ok: !input.issues?.some((issue) => issue.severity === "error"),
    context: input.context,
    source: Object.freeze({
      sourceId: input.context.sourceId,
      sourceReference: input.context.sourceReference,
      fileName: input.context.fileName,
      contentType: input.context.contentType ?? input.context.mediaType,
      format: input.context.mediaType,
    }),
    summary: Object.freeze({
      totalCount: input.totalCount,
      sampleCount: input.sampleCount,
      truncated: input.sampleCount < input.totalCount,
      sourceCount: input.sourceCount,
      successCount: input.successCount,
      failureCount: input.failureCount,
    }),
    preview: input.preview,
    sample: input.sample,
    schema: input.schema,
    metadata: input.metadata,
    issues: input.issues ?? Object.freeze([]),
    partialFailures: input.partialFailures,
  });
}
