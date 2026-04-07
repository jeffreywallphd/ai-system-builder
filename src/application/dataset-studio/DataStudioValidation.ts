import type { DataPreviewModel } from "../data-studio/DataPreviewEngine";
import type { CanonicalDataShape, CanonicalDataShapeKind, CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import type { DataAssetBase } from "@domain/dataset-studio/DataAssetBase";
import {
  DataAssetConfigFieldKinds,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";
import {
  DataConverterDiagnosticSeverities,
  createDataConverterDiagnostic,
  type DataConverterDiagnostic,
  type DataConverterRequest,
  type DataConverterResult,
  type DataSourceReference,
  type ResolvedDataSource,
} from "./DataConverterContracts";
import type { DataAssetExecutionRequest } from "./DataAssetExecutionFramework";
import { createDefaultMediaValidationAdapters } from "./adapters/validation/MediaValidationFactory";

const defaultMediaDatasetValidator = createDefaultMediaValidationAdapters().mediaDatasetValidator;

export const DataStudioValidationSections = Object.freeze({
  canonicalShape: "canonical-shape",
  converterRequest: "converter-request",
  converterResult: "converter-result",
  sourceReference: "source-reference",
  resolvedSource: "resolved-source",
  dataAssetConfig: "data-asset-config",
  executionRequest: "execution-request",
  previewModel: "preview-model",
} as const);

export type DataStudioValidationSection =
  typeof DataStudioValidationSections[keyof typeof DataStudioValidationSections];

export const DataStudioValidationIssueSeverities = Object.freeze({
  warning: "warning",
  error: "error",
} as const);

export type DataStudioValidationIssueSeverity =
  typeof DataStudioValidationIssueSeverities[keyof typeof DataStudioValidationIssueSeverities];

export interface DataStudioValidationIssue {
  readonly code: string;
  readonly section: DataStudioValidationSection;
  readonly severity: DataStudioValidationIssueSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export const DataStudioFailureKinds = Object.freeze({
  validation: "validation",
  runtime: "runtime",
} as const);

export type DataStudioFailureKind = typeof DataStudioFailureKinds[keyof typeof DataStudioFailureKinds];

export interface DataStudioFailure {
  readonly kind: DataStudioFailureKind;
  readonly code: string;
  readonly message: string;
  readonly section: DataStudioValidationSection;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
  readonly issues: ReadonlyArray<DataStudioValidationIssue>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function freezeRecord(input?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => key.length > 0);
  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

function pushIssue(
  issues: DataStudioValidationIssue[],
  input: {
    readonly code: string;
    readonly section: DataStudioValidationSection;
    readonly severity: DataStudioValidationIssueSeverity;
    readonly message: string;
    readonly path?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  },
): void {
  const code = input.code.trim();
  const message = input.message.trim();
  if (!code || !message) {
    return;
  }

  issues.push(Object.freeze({
    code,
    section: input.section,
    severity: input.severity,
    message,
    path: normalizeOptional(input.path),
    details: freezeRecord(input.details),
  }));
}

function isCanonicalRecordValue(value: unknown): value is CanonicalRecordValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isCanonicalRecordValue(entry));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((entry) => isCanonicalRecordValue(entry));
  }

  return false;
}

function validateShapeMetadata(shape: CanonicalDataShape, issues: DataStudioValidationIssue[]): void {
  if (!normalizeOptional(shape.metadata.schemaVersion)) {
    pushIssue(issues, {
      code: "metadata-schema-version-missing",
      section: DataStudioValidationSections.canonicalShape,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Canonical shape metadata.schemaVersion is required.",
      path: "metadata.schemaVersion",
    });
  }
}

function validateShapeKind(
  shape: CanonicalDataShape,
  issues: DataStudioValidationIssue[],
): void {
  if (shape.kind === "records") {
    for (const [index, record] of shape.records.entries()) {
      if (!normalizeOptional(record.recordId)) {
        pushIssue(issues, {
          code: "records-record-id-missing",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Canonical record entries require a non-empty recordId.",
          path: `records[${index}].recordId`,
        });
      }
      for (const [fieldKey, fieldValue] of Object.entries(record.fields)) {
        if (!isCanonicalRecordValue(fieldValue)) {
          pushIssue(issues, {
            code: "records-field-not-canonical",
            section: DataStudioValidationSections.canonicalShape,
            severity: DataStudioValidationIssueSeverities.error,
            message: `Record field '${fieldKey}' is not a canonical value.`,
            path: `records[${index}].fields.${fieldKey}`,
          });
        }
      }
    }
    return;
  }

  if (shape.kind === "table") {
    const columnIds = new Set<string>();
    for (const [index, column] of shape.columns.entries()) {
      const columnId = normalizeOptional(column.columnId);
      if (!columnId) {
        pushIssue(issues, {
          code: "table-column-id-missing",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Table columns require a non-empty columnId.",
          path: `columns[${index}].columnId`,
        });
        continue;
      }
      columnIds.add(columnId);
    }

    for (const [rowIndex, row] of shape.rows.entries()) {
      if (!normalizeOptional(row.rowId)) {
        pushIssue(issues, {
          code: "table-row-id-missing",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Table rows require a non-empty rowId.",
          path: `rows[${rowIndex}].rowId`,
        });
      }
      for (const [cellKey, cellValue] of Object.entries(row.cells)) {
        if (!columnIds.has(cellKey)) {
          pushIssue(issues, {
            code: "table-cell-column-unknown",
            section: DataStudioValidationSections.canonicalShape,
            severity: DataStudioValidationIssueSeverities.error,
            message: `Table row contains unknown column '${cellKey}'.`,
            path: `rows[${rowIndex}].cells.${cellKey}`,
          });
        }
        if (!isCanonicalRecordValue(cellValue)) {
          pushIssue(issues, {
            code: "table-cell-not-canonical",
            section: DataStudioValidationSections.canonicalShape,
            severity: DataStudioValidationIssueSeverities.error,
            message: `Table cell '${cellKey}' is not a canonical value.`,
            path: `rows[${rowIndex}].cells.${cellKey}`,
          });
        }
      }
    }
    return;
  }

  if (shape.kind === "text-items") {
    for (const [index, item] of shape.items.entries()) {
      if (!normalizeOptional(item.itemId)) {
        pushIssue(issues, {
          code: "text-item-id-missing",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Text item entries require a non-empty itemId.",
          path: `items[${index}].itemId`,
        });
      }
      if (!normalizeOptional(item.text)) {
        pushIssue(issues, {
          code: "text-item-text-missing",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Text item entries require non-empty text.",
          path: `items[${index}].text`,
        });
      }
      if (
        typeof item.startOffset === "number"
        && typeof item.endOffset === "number"
        && item.endOffset < item.startOffset
      ) {
        pushIssue(issues, {
          code: "text-item-offset-range-invalid",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Text item endOffset cannot be earlier than startOffset.",
          path: `items[${index}]`,
        });
      }
    }
    return;
  }

  if (shape.kind === "image-metadata-records") {
    const mediaValidation = defaultMediaDatasetValidator.validateShape(shape);
    for (const mediaIssue of mediaValidation.issues) {
      pushIssue(issues, {
        code: mediaIssue.code,
        section: DataStudioValidationSections.canonicalShape,
        severity: mediaIssue.severity,
        message: mediaIssue.message,
        path: mediaIssue.path,
        details: mediaIssue.details,
      });
    }

    for (const [index, item] of shape.items.entries()) {
      if (!normalizeOptional(item.itemId)) {
        pushIssue(issues, {
          code: "image-item-id-missing",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Image metadata entries require a non-empty itemId.",
          path: `items[${index}].itemId`,
        });
      }
      if (
        typeof item.confidence === "number"
        && (item.confidence < 0 || item.confidence > 1)
      ) {
        pushIssue(issues, {
          code: "image-item-confidence-range-invalid",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Image confidence must be between 0 and 1.",
          path: `items[${index}].confidence`,
        });
      }
      if (
        item.boundingBox
        && (item.boundingBox.width < 0 || item.boundingBox.height < 0)
      ) {
        pushIssue(issues, {
          code: "image-item-bounding-box-invalid",
          section: DataStudioValidationSections.canonicalShape,
          severity: DataStudioValidationIssueSeverities.error,
          message: "Image bounding boxes cannot have negative width or height.",
          path: `items[${index}].boundingBox`,
        });
      }
    }
  }
}

export function validateCanonicalDataShape(shape: CanonicalDataShape): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];
  validateShapeMetadata(shape, issues);
  validateShapeKind(shape, issues);
  return Object.freeze(issues);
}

function validateSourceReference(reference: DataSourceReference, issues: DataStudioValidationIssue[]): void {
  if (reference.kind === "in-memory") {
    if (reference.payload === undefined || reference.payload === null) {
      pushIssue(issues, {
        code: "source-in-memory-payload-missing",
        section: DataStudioValidationSections.sourceReference,
        severity: DataStudioValidationIssueSeverities.error,
        message: "In-memory source references require a payload.",
        path: "source.payload",
      });
    }
    return;
  }

  if (reference.kind === "local-file" && !normalizeOptional(reference.path)) {
    pushIssue(issues, {
      code: "source-local-file-path-missing",
      section: DataStudioValidationSections.sourceReference,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Local-file source references require a non-empty path.",
      path: "source.path",
    });
  }

  if (reference.kind === "url" && !normalizeOptional(reference.url)) {
    pushIssue(issues, {
      code: "source-url-missing",
      section: DataStudioValidationSections.sourceReference,
      severity: DataStudioValidationIssueSeverities.error,
      message: "URL source references require a non-empty url.",
      path: "source.url",
    });
  }
}

export function validateDataSourceReference(reference: DataSourceReference): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];
  validateSourceReference(reference, issues);
  return Object.freeze(issues);
}

export function validateResolvedDataSource(source: ResolvedDataSource): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];
  if (!normalizeOptional(source.reference)) {
    pushIssue(issues, {
      code: "resolved-source-reference-missing",
      section: DataStudioValidationSections.resolvedSource,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Resolved source requires a non-empty reference.",
      path: "source.reference",
    });
  }
  if (source.payload === undefined || source.payload === null) {
    pushIssue(issues, {
      code: "resolved-source-payload-missing",
      section: DataStudioValidationSections.resolvedSource,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Resolved source requires payload content.",
      path: "source.payload",
    });
  }
  return Object.freeze(issues);
}

export function validateDataConverterRequest(request: DataConverterRequest): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];

  if (request.operation === "source-to-records") {
    for (const issue of validateResolvedDataSource(request.source)) {
      issues.push(issue);
    }
  }

  if (request.operation === "records-to-table" && Array.isArray(request.records) && request.records.length === 0) {
    pushIssue(issues, {
      code: "records-to-table-input-empty",
      section: DataStudioValidationSections.converterRequest,
      severity: DataStudioValidationIssueSeverities.warning,
      message: "Records-to-table conversion received an empty records array.",
      path: "records",
    });
  }

  if (request.operation === "document-to-text-items" && !normalizeOptional(request.text)) {
    pushIssue(issues, {
      code: "document-text-missing",
      section: DataStudioValidationSections.converterRequest,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Document-to-text conversion requires non-empty text.",
      path: "text",
    });
  }

  if (request.operation === "image-metadata-to-records" && Object.keys(request.metadata ?? {}).length === 0) {
    pushIssue(issues, {
      code: "image-metadata-empty",
      section: DataStudioValidationSections.converterRequest,
      severity: DataStudioValidationIssueSeverities.warning,
      message: "Image metadata conversion received an empty metadata object.",
      path: "metadata",
    });
  }

  return Object.freeze(issues);
}

export function validateDataConverterResult(result: DataConverterResult): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];

  if (!result.ok && result.diagnostics.length === 0) {
    pushIssue(issues, {
      code: "converter-failure-diagnostics-missing",
      section: DataStudioValidationSections.converterResult,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Failed converter results must include at least one diagnostic.",
      path: "diagnostics",
    });
    return Object.freeze(issues);
  }

  if (!result.ok) {
    return Object.freeze(issues);
  }

  for (const issue of validateCanonicalDataShape(result.output)) {
    issues.push(Object.freeze({
      ...issue,
      section: DataStudioValidationSections.converterResult,
    }));
  }
  return Object.freeze(issues);
}

export function validateDataAssetConfig(asset: DataAssetBase): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];

  for (const key of Object.keys(asset.config.values)) {
    if (!key.trim()) {
      pushIssue(issues, {
        code: "data-asset-config-key-empty",
        section: DataStudioValidationSections.dataAssetConfig,
        severity: DataStudioValidationIssueSeverities.error,
        message: "Data asset config keys must be non-empty.",
        path: "config.values",
      });
    }
  }

  if (!normalizeOptional(asset.versionMetadata.schemaVersion)) {
    pushIssue(issues, {
      code: "data-asset-schema-version-missing",
      section: DataStudioValidationSections.dataAssetConfig,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Data asset schemaVersion is required.",
      path: "versionMetadata.schemaVersion",
    });
  }

  if (asset.composableInputShapeKinds.length === 0) {
    pushIssue(issues, {
      code: "data-asset-composable-kinds-empty",
      section: DataStudioValidationSections.dataAssetConfig,
      severity: DataStudioValidationIssueSeverities.warning,
      message: "Data asset should declare at least one composable input shape kind.",
      path: "composableInputShapeKinds",
    });
  }

  return Object.freeze(issues);
}

function isObjectRecord(value: CanonicalRecordValue): value is Readonly<Record<string, CanonicalRecordValue>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateDataAssetConfigValues(
  config: Readonly<Record<string, CanonicalRecordValue>>,
  schema: DataAssetConfigSchema,
): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];
  const fieldsByKey = new Map(schema.fields.map((field) => [field.key, field] as const));

  for (const field of schema.fields) {
    const value = config[field.key];
    const path = `config.values.${field.key}`;
    if (field.required && (value === undefined || value === null || value === "")) {
      pushIssue(issues, {
        code: "data-asset-config-required-missing",
        section: DataStudioValidationSections.dataAssetConfig,
        severity: DataStudioValidationIssueSeverities.error,
        message: `Configuration field '${field.label}' is required.`,
        path,
      });
      continue;
    }

    if (value === undefined) {
      continue;
    }

    if (field.kind === DataAssetConfigFieldKinds.string && typeof value !== "string") {
      pushIssue(issues, {
        code: "data-asset-config-type-string-expected",
        section: DataStudioValidationSections.dataAssetConfig,
        severity: DataStudioValidationIssueSeverities.error,
        message: `Configuration field '${field.label}' must be a string.`,
        path,
      });
    }

    if (field.kind === DataAssetConfigFieldKinds.number && typeof value !== "number") {
      pushIssue(issues, {
        code: "data-asset-config-type-number-expected",
        section: DataStudioValidationSections.dataAssetConfig,
        severity: DataStudioValidationIssueSeverities.error,
        message: `Configuration field '${field.label}' must be a number.`,
        path,
      });
    }

    if (field.kind === DataAssetConfigFieldKinds.boolean && typeof value !== "boolean") {
      pushIssue(issues, {
        code: "data-asset-config-type-boolean-expected",
        section: DataStudioValidationSections.dataAssetConfig,
        severity: DataStudioValidationIssueSeverities.error,
        message: `Configuration field '${field.label}' must be a boolean.`,
        path,
      });
    }

    if (field.kind === DataAssetConfigFieldKinds.select) {
      const allowed = new Set((field.options ?? []).map((option) => option.value));
      if (typeof value !== "string" || !allowed.has(value)) {
        pushIssue(issues, {
          code: "data-asset-config-select-option-invalid",
          section: DataStudioValidationSections.dataAssetConfig,
          severity: DataStudioValidationIssueSeverities.error,
          message: `Configuration field '${field.label}' must match one of the allowed options.`,
          path,
        });
      }
    }

    if (field.kind === DataAssetConfigFieldKinds.json && !isObjectRecord(value)) {
      pushIssue(issues, {
        code: "data-asset-config-type-json-expected",
        section: DataStudioValidationSections.dataAssetConfig,
        severity: DataStudioValidationIssueSeverities.error,
        message: `Configuration field '${field.label}' must be a JSON object.`,
        path,
      });
    }

    if (field.kind === DataAssetConfigFieldKinds.number && typeof value === "number") {
      if (typeof field.min === "number" && value < field.min) {
        pushIssue(issues, {
          code: "data-asset-config-number-min-violated",
          section: DataStudioValidationSections.dataAssetConfig,
          severity: DataStudioValidationIssueSeverities.error,
          message: `Configuration field '${field.label}' must be >= ${field.min}.`,
          path,
        });
      }
      if (typeof field.max === "number" && value > field.max) {
        pushIssue(issues, {
          code: "data-asset-config-number-max-violated",
          section: DataStudioValidationSections.dataAssetConfig,
          severity: DataStudioValidationIssueSeverities.error,
          message: `Configuration field '${field.label}' must be <= ${field.max}.`,
          path,
        });
      }
    }
  }

  for (const key of Object.keys(config)) {
    if (!fieldsByKey.has(key)) {
      pushIssue(issues, {
        code: "data-asset-config-key-unsupported",
        section: DataStudioValidationSections.dataAssetConfig,
        severity: DataStudioValidationIssueSeverities.warning,
        message: `Configuration key '${key}' is not defined in the config schema.`,
        path: `config.values.${key}`,
      });
    }
  }

  return Object.freeze(issues);
}

function validateExecutionInput(
  request: DataAssetExecutionRequest,
  issues: DataStudioValidationIssue[],
): void {
  if (!request.input) {
    return;
  }

  if (request.input.kind === "source-reference") {
    for (const issue of validateDataSourceReference(request.input.source)) {
      issues.push(issue);
    }
    return;
  }

  if (request.input.kind === "resolved-source") {
    for (const issue of validateResolvedDataSource(request.input.source)) {
      issues.push(issue);
    }
    return;
  }

  if (request.input.kind === "converter-request") {
    for (const issue of validateDataConverterRequest(request.input.request)) {
      issues.push(issue);
    }
    return;
  }

  if (request.input.kind === "converter-result") {
    for (const issue of validateDataConverterResult(request.input.result)) {
      issues.push(issue);
    }
    return;
  }

  for (const issue of validateCanonicalDataShape(request.input.shape)) {
    issues.push(issue);
  }
}

export function validateDataAssetExecutionRequest(
  request: DataAssetExecutionRequest,
): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];

  if (!normalizeOptional(request.asset.id)) {
    pushIssue(issues, {
      code: "execution-asset-id-missing",
      section: DataStudioValidationSections.executionRequest,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Execution requests require a non-empty asset id.",
      path: "asset.id",
    });
  }

  if (request.previewOptions?.maxItems !== undefined && request.previewOptions.maxItems < 1) {
    pushIssue(issues, {
      code: "execution-preview-max-items-invalid",
      section: DataStudioValidationSections.executionRequest,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Preview option maxItems must be greater than 0.",
      path: "previewOptions.maxItems",
    });
  }

  validateExecutionInput(request, issues);
  for (const issue of validateDataAssetConfig(request.asset)) {
    issues.push(issue);
  }

  return Object.freeze(issues);
}

export function validateDataPreviewModel(preview: DataPreviewModel): ReadonlyArray<DataStudioValidationIssue> {
  const issues: DataStudioValidationIssue[] = [];

  if (preview.summary.sampleCount > preview.summary.totalCount) {
    pushIssue(issues, {
      code: "preview-summary-sample-count-invalid",
      section: DataStudioValidationSections.previewModel,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Preview sampleCount cannot exceed totalCount.",
      path: "summary",
    });
  }

  if (preview.kind === "records" && preview.records.length !== preview.summary.sampleCount) {
    pushIssue(issues, {
      code: "preview-record-count-mismatch",
      section: DataStudioValidationSections.previewModel,
      severity: DataStudioValidationIssueSeverities.warning,
      message: "Preview record sample count does not match records length.",
      path: "records",
    });
  }

  if (preview.kind === "table" && preview.rows.length !== preview.summary.sampleCount) {
    pushIssue(issues, {
      code: "preview-table-row-count-mismatch",
      section: DataStudioValidationSections.previewModel,
      severity: DataStudioValidationIssueSeverities.warning,
      message: "Preview table sample count does not match row length.",
      path: "rows",
    });
  }

  if (preview.kind === "text-items" && preview.items.length !== preview.summary.sampleCount) {
    pushIssue(issues, {
      code: "preview-text-item-count-mismatch",
      section: DataStudioValidationSections.previewModel,
      severity: DataStudioValidationIssueSeverities.warning,
      message: "Preview text-item sample count does not match items length.",
      path: "items",
    });
  }

  if (preview.kind === "image-metadata-records" && preview.items.length !== preview.summary.sampleCount) {
    pushIssue(issues, {
      code: "preview-image-item-count-mismatch",
      section: DataStudioValidationSections.previewModel,
      severity: DataStudioValidationIssueSeverities.warning,
      message: "Preview image metadata sample count does not match items length.",
      path: "items",
    });
  }

  if (preview.kind === "image-metadata-records") {
    if (preview.window.returned !== preview.items.length) {
      pushIssue(issues, {
        code: "preview-image-window-returned-count-mismatch",
        section: DataStudioValidationSections.previewModel,
        severity: DataStudioValidationIssueSeverities.warning,
        message: "Preview image window returned count does not match item length.",
        path: "window.returned",
      });
    }
    if (preview.window.offset < 0) {
      pushIssue(issues, {
        code: "preview-image-window-offset-invalid",
        section: DataStudioValidationSections.previewModel,
        severity: DataStudioValidationIssueSeverities.error,
        message: "Preview image window offset cannot be negative.",
        path: "window.offset",
      });
    }
  }

  if (preview.kind === "error" && !normalizeOptional(preview.message)) {
    pushIssue(issues, {
      code: "preview-error-message-missing",
      section: DataStudioValidationSections.previewModel,
      severity: DataStudioValidationIssueSeverities.error,
      message: "Error previews require a non-empty message.",
      path: "message",
    });
  }

  return Object.freeze(issues);
}

export function hasErrorIssues(issues: ReadonlyArray<DataStudioValidationIssue>): boolean {
  return issues.some((issue) => issue.severity === DataStudioValidationIssueSeverities.error);
}

export function toDataConverterDiagnostics(
  issues: ReadonlyArray<DataStudioValidationIssue>,
): ReadonlyArray<DataConverterDiagnostic> {
  return Object.freeze(issues.map((issue) =>
    createDataConverterDiagnostic({
      code: issue.code,
      severity: issue.severity === DataStudioValidationIssueSeverities.error
        ? DataConverterDiagnosticSeverities.error
        : DataConverterDiagnosticSeverities.warning,
      message: issue.message,
      path: issue.path,
      details: {
        section: issue.section,
        ...(issue.details ?? {}),
      },
    })));
}

export function createDataStudioFailure(input: {
  readonly kind: DataStudioFailureKind;
  readonly code: string;
  readonly message: string;
  readonly section: DataStudioValidationSection;
  readonly issues?: ReadonlyArray<DataStudioValidationIssue>;
  readonly diagnostics?: ReadonlyArray<DataConverterDiagnostic>;
}): DataStudioFailure {
  return Object.freeze({
    kind: input.kind,
    code: input.code,
    message: input.message,
    section: input.section,
    issues: input.issues ?? Object.freeze([]),
    diagnostics: input.diagnostics ?? Object.freeze([]),
  });
}

export function summarizeIssueCountByShapeKind(
  shape: CanonicalDataShape,
): Readonly<Record<CanonicalDataShapeKind, number>> {
  return Object.freeze({
    records: shape.kind === "records" ? shape.records.length : 0,
    table: shape.kind === "table" ? shape.rows.length : 0,
    "text-items": shape.kind === "text-items" ? shape.items.length : 0,
    "image-metadata-records": shape.kind === "image-metadata-records" ? shape.items.length : 0,
  });
}

