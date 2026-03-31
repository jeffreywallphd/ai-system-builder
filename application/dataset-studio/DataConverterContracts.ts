import type {
  CanonicalDataMetadata,
  CanonicalDataShape,
  CanonicalImageMetadataRecordsShape,
  CanonicalRecordItem,
  CanonicalRecordsShape,
  CanonicalTableShape,
  CanonicalTextItemsShape,
} from "../../domain/dataset-studio/CanonicalDataShapes";

export const DataConverterOperationKinds = Object.freeze({
  sourceToRecords: "source-to-records",
  recordsToTable: "records-to-table",
  documentToTextItems: "document-to-text-items",
  imageMetadataToRecords: "image-metadata-to-records",
} as const);

export type DataConverterOperationKind = typeof DataConverterOperationKinds[keyof typeof DataConverterOperationKinds];

export const DataConverterInputBoundaryKinds = Object.freeze({
  rawSourceReference: "raw-source-reference",
  resolvedSource: "resolved-source",
  canonicalRecords: "canonical-records",
  documentText: "document-text",
  imageMetadata: "image-metadata",
} as const);

export type DataConverterInputBoundaryKind =
  typeof DataConverterInputBoundaryKinds[keyof typeof DataConverterInputBoundaryKinds];

export const DataConverterDiagnosticSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
} as const);

export type DataConverterDiagnosticSeverity =
  typeof DataConverterDiagnosticSeverities[keyof typeof DataConverterDiagnosticSeverities];

export interface DataConverterDiagnostic {
  readonly code: string;
  readonly severity: DataConverterDiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface DataConverterOperationContext {
  readonly requestId?: string;
  readonly operationId?: string;
  readonly pipelineId?: string;
  readonly stageId?: string;
  readonly initiatedBy?: string;
  readonly lineageAssetId?: string;
  readonly lineageVersionId?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface DataConverterContractMetadata {
  readonly schemaVersion: string;
  readonly converterId: string;
  readonly converterVersion: string;
  readonly operation: DataConverterOperationKind;
  readonly inputBoundary: DataConverterInputBoundaryKind;
  readonly outputShapeKind: CanonicalDataShape["kind"];
}

export interface DataConverterRequestBase {
  readonly operation: DataConverterOperationKind;
  readonly context?: DataConverterOperationContext;
}

export interface DataConverterSourceToRecordsRequest extends DataConverterRequestBase {
  readonly operation: typeof DataConverterOperationKinds.sourceToRecords;
  readonly source: ResolvedDataSource;
  readonly formatHint?: "json" | "csv" | "tsv" | "text";
  readonly delimiter?: "," | "\t" | ";" | "|";
  readonly hasHeaderRow?: boolean;
  readonly header?: boolean | "auto";
  readonly encoding?: string;
  readonly skipEmptyLines?: boolean;
  readonly normalizeHeadersToLowercase?: boolean;
  readonly flatten?: boolean;
  readonly maxDepth?: number;
}

export interface DataConverterRecordsToTableRequest extends DataConverterRequestBase {
  readonly operation: typeof DataConverterOperationKinds.recordsToTable;
  readonly records: CanonicalRecordsShape | ReadonlyArray<CanonicalRecordItem>;
  readonly includeColumns?: ReadonlyArray<string>;
  readonly metadata?: Partial<CanonicalDataMetadata>;
}

export interface DataConverterDocumentToTextItemsRequest extends DataConverterRequestBase {
  readonly operation: typeof DataConverterOperationKinds.documentToTextItems;
  readonly documentId?: string;
  readonly text: string;
  readonly chunking?: {
    readonly mode: "line" | "paragraph" | "fixed-size";
    readonly size?: number;
    readonly overlap?: number;
  };
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface DataConverterImageMetadataToRecordsRequest extends DataConverterRequestBase {
  readonly operation: typeof DataConverterOperationKinds.imageMetadataToRecords;
  readonly imageId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export type DataConverterRequest =
  | DataConverterSourceToRecordsRequest
  | DataConverterRecordsToTableRequest
  | DataConverterDocumentToTextItemsRequest
  | DataConverterImageMetadataToRecordsRequest;

export interface DataConverterResultBase<TShape extends CanonicalDataShape> {
  readonly ok: true;
  readonly operation: DataConverterOperationKind;
  readonly context: DataConverterOperationContext;
  readonly contract: DataConverterContractMetadata;
  readonly metadata: CanonicalDataMetadata;
  readonly output: TShape;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
}

export interface DataConverterFailureResult {
  readonly ok: false;
  readonly operation: DataConverterOperationKind;
  readonly context: DataConverterOperationContext;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
}

export type DataConverterSuccessResult =
  | DataConverterResultBase<CanonicalRecordsShape>
  | DataConverterResultBase<CanonicalTableShape>
  | DataConverterResultBase<CanonicalTextItemsShape>
  | DataConverterResultBase<CanonicalImageMetadataRecordsShape>;

export type DataConverterResult = DataConverterSuccessResult | DataConverterFailureResult;

export const DataSourceReferenceKinds = Object.freeze({
  inMemory: "in-memory",
  localFile: "local-file",
  url: "url",
} as const);

export type DataSourceReferenceKind = typeof DataSourceReferenceKinds[keyof typeof DataSourceReferenceKinds];

export interface InMemoryDataSourceReference {
  readonly kind: typeof DataSourceReferenceKinds.inMemory;
  readonly payload:
    | string
    | Uint8Array
    | Readonly<Record<string, unknown>>
    | ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly formatHint?: "json" | "csv" | "tsv" | "text";
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface LocalFileDataSourceReference {
  readonly kind: typeof DataSourceReferenceKinds.localFile;
  readonly path: string;
  readonly payload?: string | Uint8Array;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly formatHint?: "json" | "csv" | "tsv" | "text";
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface UrlDataSourceReference {
  readonly kind: typeof DataSourceReferenceKinds.url;
  readonly url: string;
  readonly payload?: string | Uint8Array;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly formatHint?: "json" | "csv" | "tsv" | "text";
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export type DataSourceReference =
  | InMemoryDataSourceReference
  | LocalFileDataSourceReference
  | UrlDataSourceReference;

export interface ResolvedDataSource {
  readonly kind: DataSourceReferenceKind;
  readonly reference: string;
  readonly payload:
    | string
    | Uint8Array
    | Readonly<Record<string, unknown>>
    | ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly formatHint?: "json" | "csv" | "tsv" | "text";
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRecord(input?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, value]) => [key.trim(), value] as const);

  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

export function normalizeDataConverterContext(
  context?: DataConverterOperationContext,
): DataConverterOperationContext {
  return Object.freeze({
    requestId: normalizeOptional(context?.requestId),
    operationId: normalizeOptional(context?.operationId),
    pipelineId: normalizeOptional(context?.pipelineId),
    stageId: normalizeOptional(context?.stageId),
    initiatedBy: normalizeOptional(context?.initiatedBy),
    lineageAssetId: normalizeOptional(context?.lineageAssetId),
    lineageVersionId: normalizeOptional(context?.lineageVersionId),
    attributes: normalizeRecord(context?.attributes),
  });
}

export function createDataConverterDiagnostic(input: {
  readonly code: string;
  readonly severity: DataConverterDiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): DataConverterDiagnostic {
  const code = input.code.trim();
  if (!code) {
    throw new Error("Data converter diagnostics require a non-empty code.");
  }

  const message = input.message.trim();
  if (!message) {
    throw new Error("Data converter diagnostics require a non-empty message.");
  }

  return Object.freeze({
    code,
    severity: input.severity,
    message,
    path: normalizeOptional(input.path),
    details: normalizeRecord(input.details),
  });
}

export function mergeDataConverterMetadata(input: {
  readonly base?: Partial<CanonicalDataMetadata>;
  readonly converterId: string;
  readonly converterVersion: string;
  readonly operationId?: string;
}): Partial<CanonicalDataMetadata> {
  return Object.freeze({
    ...input.base,
    transformation: Object.freeze({
      ...(input.base?.transformation ?? {}),
      transformationId: normalizeOptional(input.operationId) ?? input.base?.transformation?.transformationId,
      converterId: input.converterId,
      converterVersion: input.converterVersion,
    }),
  });
}

export function resolveFormatFromReference(reference: DataSourceReference): "json" | "csv" | "tsv" | "text" | undefined {
  if (reference.kind === DataSourceReferenceKinds.inMemory) {
    return reference.formatHint;
  }

  const explicit = reference.formatHint;
  if (explicit) {
    return explicit;
  }

  const pathValue = reference.kind === DataSourceReferenceKinds.localFile ? reference.path : reference.url;
  const lower = pathValue.toLowerCase();
  if (lower.endsWith(".json")) {
    return "json";
  }
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".tsv")) {
    return "tsv";
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return "text";
  }

  return undefined;
}
