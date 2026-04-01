import type { DataAssetRegistryDescriptor } from "../dataset-studio/DataAssetRegistry";
import type { DataStudioValidationIssue } from "../dataset-studio/DataStudioValidation";
import type { DataPreviewModel } from "./DataPreviewEngine";
import type { DataAssetExecutionResult } from "../dataset-studio/DataAssetExecutionFramework";

export interface DatasetInspectionFieldDefinition {
  readonly name: string;
  readonly valueType?: string;
}

export interface DatasetInspectionViewModel {
  readonly title: string;
  readonly intent: {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly contractVersion: string;
  };
  readonly shapeKind?: string;
  readonly recordStructure: string;
  readonly fields: ReadonlyArray<DatasetInspectionFieldDefinition>;
  readonly validationSummary: {
    readonly errors: number;
    readonly warnings: number;
    readonly valid: boolean;
  };
  readonly validationIssues: ReadonlyArray<DataStudioValidationIssue>;
  readonly sampleRecords: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

function toIssue(issue: { readonly code: string; readonly message: string; readonly severity: "warning" | "error"; readonly path?: string }): DataStudioValidationIssue {
  return Object.freeze({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    path: issue.path,
    section: "execution-request",
  });
}

function fieldsFromPreview(preview: DataPreviewModel): ReadonlyArray<DatasetInspectionFieldDefinition> {
  if (preview.kind === "table") {
    return Object.freeze(preview.columns.map((column) => Object.freeze({
      name: column.columnId,
      valueType: column.valueType,
    })));
  }
  if (preview.kind === "records") {
    const fieldNames = new Set<string>();
    for (const record of preview.records) {
      Object.keys(record.fields).forEach((key) => fieldNames.add(key));
    }
    return Object.freeze([...fieldNames].sort().map((name) => Object.freeze({ name })));
  }
  if (preview.kind === "text-items") {
    return Object.freeze([
      Object.freeze({ name: "itemId", valueType: "string" }),
      Object.freeze({ name: "text", valueType: "string" }),
      Object.freeze({ name: "sourceDocumentId", valueType: "string" }),
    ]);
  }
  if (preview.kind === "image-metadata-records") {
    return Object.freeze([
      Object.freeze({ name: "itemId", valueType: "string" }),
      Object.freeze({ name: "assetRef", valueType: "object" }),
      Object.freeze({ name: "width", valueType: "number" }),
      Object.freeze({ name: "height", valueType: "number" }),
      Object.freeze({ name: "format", valueType: "string" }),
      Object.freeze({ name: "metadata", valueType: "object" }),
      Object.freeze({ name: "tags", valueType: "array<string>" }),
      Object.freeze({ name: "annotations", valueType: "object" }),
      Object.freeze({ name: "derived", valueType: "object" }),
    ]);
  }
  return Object.freeze([]);
}

function sampleRecordsFromPreview(preview: DataPreviewModel): ReadonlyArray<Readonly<Record<string, unknown>>> {
  if (preview.kind === "records") {
    return Object.freeze(preview.records.slice(0, 3).map((record) => Object.freeze(record.fields as Readonly<Record<string, unknown>>)));
  }
  if (preview.kind === "table") {
    return Object.freeze(preview.rows.slice(0, 3).map((row) => Object.freeze(row.cells as Readonly<Record<string, unknown>>)));
  }
  if (preview.kind === "text-items") {
    return Object.freeze(preview.items.slice(0, 3).map((item) => Object.freeze({
      itemId: item.itemId,
      text: item.text,
      sourceDocumentId: item.sourceDocumentId,
    })));
  }
  if (preview.kind === "image-metadata-records") {
    return Object.freeze(preview.items.slice(0, 3).map((item) => Object.freeze({
      itemId: item.itemId,
      imageReference: item.imageReference,
      width: item.width,
      height: item.height,
      format: item.format,
      metadata: item.metadataSummary,
      tags: item.tags,
    })));
  }
  return Object.freeze([]);
}

export function buildDatasetInspectionViewModel(input: {
  readonly descriptor: DataAssetRegistryDescriptor;
  readonly executionResult?: DataAssetExecutionResult;
  readonly previewModel?: DataPreviewModel;
  readonly previewIssues?: ReadonlyArray<DataStudioValidationIssue>;
}): DatasetInspectionViewModel {
  const preview = input.executionResult?.preview ?? input.previewModel;
  const validationIssues = Object.freeze([
    ...input.descriptor.schemaIntent.validationIssues.map(toIssue),
    ...(input.executionResult?.validationIssues ?? []),
    ...(input.previewIssues ?? []),
  ]);
  const errors = validationIssues.filter((issue) => issue.severity === "error").length;
  const warnings = validationIssues.filter((issue) => issue.severity === "warning").length;

  return Object.freeze({
    title: input.descriptor.display.title ?? input.descriptor.name,
    intent: Object.freeze({
      id: input.descriptor.schemaIntent.id,
      name: input.descriptor.schemaIntent.name,
      description: input.descriptor.schemaIntent.description,
      contractVersion: input.descriptor.schemaIntent.contractVersion,
    }),
    shapeKind: preview?.kind ?? input.descriptor.outputShapeKind,
    recordStructure: preview
      ? `Expected ${preview.kind} records shaped by schema intent '${input.descriptor.schemaIntent.id}'.`
      : `No preview records available yet. Expected shape '${input.descriptor.outputShapeKind}'.`,
    fields: preview ? fieldsFromPreview(preview) : Object.freeze([]),
    validationSummary: Object.freeze({
      errors,
      warnings,
      valid: errors === 0,
    }),
    validationIssues,
    sampleRecords: preview ? sampleRecordsFromPreview(preview) : Object.freeze([]),
  });
}
