import type {
  CanonicalDataMetadata,
  CanonicalDataShape,
  CanonicalDataShapeKind,
  CanonicalRecordValue,
  CanonicalTableColumn,
  CanonicalTableRow,
  CanonicalTextItem,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DataAssetBase } from "../../domain/dataset-studio/DataAssetBase";
import type {
  DataConverterDiagnostic,
  DataConverterResult,
  DataConverterSuccessResult,
} from "../dataset-studio/DataConverterContracts";
import {
  buildImageDatasetPreview,
  type ImageDatasetPreviewItem,
} from "./ImageDatasetPreviewBuilder";

export interface DataPreviewEngineOptions {
  readonly maxItems?: number;
  readonly maxColumns?: number;
  readonly maxTextLength?: number;
}

export interface DataPreviewSummary {
  readonly totalCount: number;
  readonly sampleCount: number;
  readonly truncated: boolean;
}

export interface DataPreviewMetadataSummary {
  readonly schemaVersion: string;
  readonly sourceFileName?: string;
  readonly sourceFormat?: string;
  readonly lineageCount: number;
  readonly converterId?: string;
  readonly converterVersion?: string;
}

export interface DataPreviewDiagnosticsSummary {
  readonly infoCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
}

export interface DataPreviewBase {
  readonly kind: CanonicalDataShapeKind | "error";
  readonly summary: DataPreviewSummary;
  readonly metadata: DataPreviewMetadataSummary;
  readonly diagnostics: DataPreviewDiagnosticsSummary;
}

export interface DataPreviewRecordItem {
  readonly recordId: string;
  readonly fields: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DataRecordsPreviewModel extends DataPreviewBase {
  readonly kind: "records";
  readonly records: ReadonlyArray<DataPreviewRecordItem>;
}

export interface DataTablePreviewRow {
  readonly rowId: string;
  readonly cells: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DataTablePreviewModel extends DataPreviewBase {
  readonly kind: "table";
  readonly columns: ReadonlyArray<CanonicalTableColumn>;
  readonly rows: ReadonlyArray<DataTablePreviewRow>;
}

export interface DataTextPreviewItem {
  readonly itemId: string;
  readonly text: string;
  readonly sourceDocumentId?: string;
  readonly startOffset?: number;
  readonly endOffset?: number;
}

export interface DataTextItemsPreviewModel extends DataPreviewBase {
  readonly kind: "text-items";
  readonly items: ReadonlyArray<DataTextPreviewItem>;
}

export interface DataImageMetadataPreviewModel extends DataPreviewBase {
  readonly kind: "image-metadata-records";
  readonly items: ReadonlyArray<ImageDatasetPreviewItem>;
}

export interface DataPreviewErrorModel extends DataPreviewBase {
  readonly kind: "error";
  readonly message: string;
}

export type DataPreviewModel =
  | DataRecordsPreviewModel
  | DataTablePreviewModel
  | DataTextItemsPreviewModel
  | DataImageMetadataPreviewModel
  | DataPreviewErrorModel;

function normalizeOptions(options?: DataPreviewEngineOptions): Required<DataPreviewEngineOptions> {
  return Object.freeze({
    maxItems: Math.max(1, options?.maxItems ?? 10),
    maxColumns: Math.max(1, options?.maxColumns ?? 8),
    maxTextLength: Math.max(16, options?.maxTextLength ?? 220),
  });
}

function summarizeDiagnostics(diagnostics: ReadonlyArray<DataConverterDiagnostic>): DataPreviewDiagnosticsSummary {
  const infoCount = diagnostics.filter((entry) => entry.severity === "info").length;
  const warningCount = diagnostics.filter((entry) => entry.severity === "warning").length;
  const errorCount = diagnostics.filter((entry) => entry.severity === "error").length;

  return Object.freeze({
    infoCount,
    warningCount,
    errorCount,
    diagnostics,
  });
}

function summarizeMetadata(metadata: CanonicalDataMetadata): DataPreviewMetadataSummary {
  return Object.freeze({
    schemaVersion: metadata.schemaVersion,
    sourceFileName: metadata.source?.fileName,
    sourceFormat: metadata.source?.format,
    lineageCount: metadata.lineage?.length ?? 0,
    converterId: metadata.transformation?.converterId,
    converterVersion: metadata.transformation?.converterVersion,
  });
}

function summarizeCounts(totalCount: number, sampleCount: number): DataPreviewSummary {
  return Object.freeze({
    totalCount,
    sampleCount,
    truncated: sampleCount < totalCount,
  });
}

function clipText(value: string, maxTextLength: number): string {
  return value.length <= maxTextLength
    ? value
    : `${value.slice(0, Math.max(1, maxTextLength - 3))}...`;
}

export interface IDataPreviewEngine {
  buildFromCanonicalShape(
    shape: CanonicalDataShape,
    options?: DataPreviewEngineOptions,
    diagnostics?: ReadonlyArray<DataConverterDiagnostic>,
  ): DataPreviewModel;
  buildFromConverterResult(result: DataConverterResult, options?: DataPreviewEngineOptions): DataPreviewModel;
  buildFromDataAsset(asset: DataAssetBase, options?: DataPreviewEngineOptions): DataPreviewModel;
}

export class DataPreviewEngine implements IDataPreviewEngine {
  public buildFromCanonicalShape(
    shape: CanonicalDataShape,
    options?: DataPreviewEngineOptions,
    diagnostics: ReadonlyArray<DataConverterDiagnostic> = Object.freeze([]),
  ): DataPreviewModel {
    const normalizedOptions = normalizeOptions(options);
    const metadata = summarizeMetadata(shape.metadata);

    switch (shape.kind) {
      case "records": {
        const records = shape.records.slice(0, normalizedOptions.maxItems).map((record) => Object.freeze({
          recordId: record.recordId,
          fields: record.fields,
        }));

        return Object.freeze({
          kind: "records",
          summary: summarizeCounts(shape.records.length, records.length),
          metadata,
          diagnostics: summarizeDiagnostics(diagnostics),
          records: Object.freeze(records),
        });
      }
      case "table": {
        const columns = shape.columns.slice(0, normalizedOptions.maxColumns);
        const rows = shape.rows
          .slice(0, normalizedOptions.maxItems)
          .map((row) => this.mapTableRow(row, columns));

        return Object.freeze({
          kind: "table",
          summary: summarizeCounts(shape.rows.length, rows.length),
          metadata,
          diagnostics: summarizeDiagnostics(diagnostics),
          columns: Object.freeze(columns),
          rows: Object.freeze(rows),
        });
      }
      case "text-items": {
        const items = shape.items.slice(0, normalizedOptions.maxItems).map((item) => this.mapTextItem(item, normalizedOptions.maxTextLength));

        return Object.freeze({
          kind: "text-items",
          summary: summarizeCounts(shape.items.length, items.length),
          metadata,
          diagnostics: summarizeDiagnostics(diagnostics),
          items: Object.freeze(items),
        });
      }
      case "image-metadata-records": {
        const imagePreview = buildImageDatasetPreview(shape, normalizedOptions.maxItems);
        const combinedDiagnostics = Object.freeze([
          ...diagnostics,
          ...imagePreview.diagnostics,
        ]);
        return Object.freeze({
          kind: "image-metadata-records",
          summary: summarizeCounts(shape.items.length, imagePreview.items.length),
          metadata,
          diagnostics: summarizeDiagnostics(combinedDiagnostics),
          items: imagePreview.items,
        });
      }
      default:
        return this.buildErrorPreview(
          "Unsupported canonical data shape for preview.",
          diagnostics,
        );
    }
  }

  public buildFromConverterResult(result: DataConverterResult, options?: DataPreviewEngineOptions): DataPreviewModel {
    if (!result.ok) {
      return this.buildErrorPreview(
        result.diagnostics[0]?.message ?? "Data conversion failed.",
        result.diagnostics,
      );
    }

    return this.buildFromConverterSuccessResult(result, options);
  }

  public buildFromDataAsset(asset: DataAssetBase, options?: DataPreviewEngineOptions): DataPreviewModel {
    if (!asset.supportsPreview) {
      return this.buildErrorPreview(`Asset '${asset.id}' does not support preview output.`, Object.freeze([]));
    }

    return this.buildFromCanonicalShape(asset.toCanonicalDataShape(), options, Object.freeze([]));
  }

  private mapTableRow(
    row: CanonicalTableRow,
    columns: ReadonlyArray<CanonicalTableColumn>,
  ): DataTablePreviewRow {
    const cells = Object.fromEntries(columns.map((column) => [column.columnId, row.cells[column.columnId] ?? null]));
    return Object.freeze({
      rowId: row.rowId,
      cells: Object.freeze(cells),
    });
  }

  private mapTextItem(item: CanonicalTextItem, maxTextLength: number): DataTextPreviewItem {
    return Object.freeze({
      itemId: item.itemId,
      text: clipText(item.text, maxTextLength),
      sourceDocumentId: item.sourceDocumentId,
      startOffset: item.startOffset,
      endOffset: item.endOffset,
    });
  }

  private buildFromConverterSuccessResult(
    result: DataConverterSuccessResult,
    options?: DataPreviewEngineOptions,
  ): DataPreviewModel {
    return this.buildFromCanonicalShape(result.output, options, result.diagnostics);
  }

  private buildErrorPreview(
    message: string,
    diagnostics: ReadonlyArray<DataConverterDiagnostic>,
  ): DataPreviewErrorModel {
    return Object.freeze({
      kind: "error",
      message,
      summary: summarizeCounts(0, 0),
      metadata: Object.freeze({
        schemaVersion: "1.0.0",
        lineageCount: 0,
      }),
      diagnostics: summarizeDiagnostics(diagnostics),
    });
  }
}


