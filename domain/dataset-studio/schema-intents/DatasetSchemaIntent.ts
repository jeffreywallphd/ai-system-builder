import type { CanonicalDataShape, CanonicalDataShapeKind } from "../CanonicalDataShapes";

export const DatasetSchemaIntentIds = Object.freeze({
  tabular: "tabular",
  document: "document",
  semantic: "semantic",
  media: "media",
} as const);

export type DatasetSchemaIntentId =
  typeof DatasetSchemaIntentIds[keyof typeof DatasetSchemaIntentIds];

export const DatasetSchemaIntentValidationSeverities = Object.freeze({
  warning: "warning",
  error: "error",
} as const);

export type DatasetSchemaIntentValidationSeverity =
  typeof DatasetSchemaIntentValidationSeverities[keyof typeof DatasetSchemaIntentValidationSeverities];

export interface DatasetSchemaIntentValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: DatasetSchemaIntentValidationSeverity;
  readonly path?: string;
}

export interface DatasetSchemaIntentValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<DatasetSchemaIntentValidationIssue>;
}

export interface DatasetSchemaIntentDescriptor {
  readonly id: DatasetSchemaIntentId;
  readonly name: string;
  readonly description: string;
  readonly contractVersion: string;
  readonly supportedShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface IDatasetSchemaIntent {
  readonly descriptor: DatasetSchemaIntentDescriptor;
  validateShape(shape: CanonicalDataShape): DatasetSchemaIntentValidationResult;
}

export interface IMediaSchemaIntent extends IDatasetSchemaIntent {
  readonly descriptor: DatasetSchemaIntentDescriptor & {
    readonly id: typeof DatasetSchemaIntentIds.media;
  };
}

export interface IDatasetSchemaIntentRegistry {
  register(intent: IDatasetSchemaIntent): void;
  get(intentId: DatasetSchemaIntentId): IDatasetSchemaIntent | undefined;
  list(): ReadonlyArray<DatasetSchemaIntentDescriptor>;
  resolveForShapeKind(shapeKind: CanonicalDataShapeKind): IDatasetSchemaIntent | undefined;
}

export function createSchemaIntentValidationResult(
  issues: ReadonlyArray<DatasetSchemaIntentValidationIssue>,
): DatasetSchemaIntentValidationResult {
  const hasErrors = issues.some((issue) => issue.severity === DatasetSchemaIntentValidationSeverities.error);
  return Object.freeze({
    valid: !hasErrors,
    issues: Object.freeze([...issues]),
  });
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createSchemaIntentValidationIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: DatasetSchemaIntentValidationSeverity;
  readonly path?: string;
}): DatasetSchemaIntentValidationIssue {
  const code = input.code.trim();
  const message = input.message.trim();
  if (!code) {
    throw new Error("DatasetSchemaIntentValidationIssue.code cannot be empty.");
  }
  if (!message) {
    throw new Error("DatasetSchemaIntentValidationIssue.message cannot be empty.");
  }

  return Object.freeze({
    code,
    message,
    severity: input.severity ?? DatasetSchemaIntentValidationSeverities.error,
    path: normalizeOptional(input.path),
  });
}
