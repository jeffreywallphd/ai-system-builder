import type { CanonicalDataShapeKind, CanonicalRecordValue } from "./CanonicalDataShapes";

export const DataLineageReferenceKinds = Object.freeze({
  sourceReference: "source-reference",
  resolvedSource: "resolved-source",
  canonicalShape: "canonical-shape",
  asset: "asset",
  intermediate: "intermediate",
  preview: "preview",
} as const);

export type DataLineageReferenceKind =
  typeof DataLineageReferenceKinds[keyof typeof DataLineageReferenceKinds];

export const DataLineageStepKinds = Object.freeze({
  validate: "validate",
  resolveSource: "resolve-source",
  convert: "convert",
  preview: "preview",
  packageResult: "package-result",
} as const);

export type DataLineageStepKind = typeof DataLineageStepKinds[keyof typeof DataLineageStepKinds];

export const DataLineageStepStatuses = Object.freeze({
  completed: "completed",
  failed: "failed",
  skipped: "skipped",
} as const);

export type DataLineageStepStatus = typeof DataLineageStepStatuses[keyof typeof DataLineageStepStatuses];

export const DataLineageDiagnosticSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
} as const);

export type DataLineageDiagnosticSeverity =
  typeof DataLineageDiagnosticSeverities[keyof typeof DataLineageDiagnosticSeverities];

export interface DataLineageDiagnosticNote {
  readonly code: string;
  readonly severity: DataLineageDiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DataLineageReference {
  readonly referenceId: string;
  readonly kind: DataLineageReferenceKind;
  readonly label?: string;
  readonly assetId?: string;
  readonly versionId?: string;
  readonly shapeKind?: CanonicalDataShapeKind;
  readonly attributes?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DataLineageExecutionStep {
  readonly stepId: string;
  readonly kind: DataLineageStepKind;
  readonly status: DataLineageStepStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly inputReferenceIds: ReadonlyArray<string>;
  readonly outputReferenceIds: ReadonlyArray<string>;
  readonly diagnostics?: ReadonlyArray<DataLineageDiagnosticNote>;
  readonly notes?: ReadonlyArray<string>;
}

export interface DataLineageExecutionMarker {
  readonly executionId: string;
  readonly requestId?: string;
  readonly operationId?: string;
  readonly pipelineId?: string;
  readonly stageId?: string;
  readonly startedAt: string;
  readonly completedAt?: string;
}

export interface DataLineageProducerReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name?: string;
}

export interface DataLineageMetadata {
  readonly schemaVersion: string;
  readonly capturedAt: string;
  readonly producer: DataLineageProducerReference;
  readonly execution: DataLineageExecutionMarker;
  readonly inputs: ReadonlyArray<DataLineageReference>;
  readonly steps: ReadonlyArray<DataLineageExecutionStep>;
  readonly outputs: ReadonlyArray<DataLineageReference>;
  readonly diagnostics?: ReadonlyArray<DataLineageDiagnosticNote>;
  readonly notes?: ReadonlyArray<string>;
  readonly attributes?: Readonly<Record<string, CanonicalRecordValue>>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRecord(
  value?: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, recordValue]) => [key.trim(), recordValue] as const)
    .filter(([key]) => key.length > 0);

  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

function normalizeId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }

  return normalized;
}

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeDiagnostics(
  diagnostics?: ReadonlyArray<DataLineageDiagnosticNote>,
): ReadonlyArray<DataLineageDiagnosticNote> | undefined {
  if (!diagnostics) {
    return undefined;
  }

  const normalized = diagnostics.map((diagnostic) =>
    createDataLineageDiagnosticNote({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      path: diagnostic.path,
      details: diagnostic.details,
    }));
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

export function createDataLineageDiagnosticNote(input: {
  readonly code: string;
  readonly severity: DataLineageDiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, CanonicalRecordValue>>;
}): DataLineageDiagnosticNote {
  const code = normalizeId(input.code, "DataLineageDiagnosticNote.code");
  const message = normalizeId(input.message, "DataLineageDiagnosticNote.message");

  return Object.freeze({
    code,
    severity: input.severity,
    message,
    path: normalizeOptional(input.path),
    details: normalizeRecord(input.details),
  });
}

export function createDataLineageReference(input: {
  readonly referenceId: string;
  readonly kind: DataLineageReferenceKind;
  readonly label?: string;
  readonly assetId?: string;
  readonly versionId?: string;
  readonly shapeKind?: CanonicalDataShapeKind;
  readonly attributes?: Readonly<Record<string, CanonicalRecordValue>>;
}): DataLineageReference {
  return Object.freeze({
    referenceId: normalizeId(input.referenceId, "DataLineageReference.referenceId"),
    kind: input.kind,
    label: normalizeOptional(input.label),
    assetId: normalizeOptional(input.assetId),
    versionId: normalizeOptional(input.versionId),
    shapeKind: input.shapeKind,
    attributes: normalizeRecord(input.attributes),
  });
}

export function createDataLineageExecutionStep(input: {
  readonly stepId: string;
  readonly kind: DataLineageStepKind;
  readonly status: DataLineageStepStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly inputReferenceIds?: ReadonlyArray<string>;
  readonly outputReferenceIds?: ReadonlyArray<string>;
  readonly diagnostics?: ReadonlyArray<DataLineageDiagnosticNote>;
  readonly notes?: ReadonlyArray<string>;
}): DataLineageExecutionStep {
  return Object.freeze({
    stepId: normalizeId(input.stepId, "DataLineageExecutionStep.stepId"),
    kind: input.kind,
    status: input.status,
    startedAt: normalizeId(input.startedAt, "DataLineageExecutionStep.startedAt"),
    completedAt: normalizeOptional(input.completedAt),
    inputReferenceIds: normalizeStringArray(input.inputReferenceIds) ?? Object.freeze([]),
    outputReferenceIds: normalizeStringArray(input.outputReferenceIds) ?? Object.freeze([]),
    diagnostics: normalizeDiagnostics(input.diagnostics),
    notes: normalizeStringArray(input.notes),
  });
}

function normalizeReferences(
  references?: ReadonlyArray<DataLineageReference>,
): ReadonlyArray<DataLineageReference> {
  const deduped = new Map<string, DataLineageReference>();
  for (const reference of references ?? []) {
    const normalized = createDataLineageReference(reference);
    deduped.set(normalized.referenceId, normalized);
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeSteps(steps?: ReadonlyArray<DataLineageExecutionStep>): ReadonlyArray<DataLineageExecutionStep> {
  const deduped = new Map<string, DataLineageExecutionStep>();
  for (const step of steps ?? []) {
    const normalized = createDataLineageExecutionStep(step);
    deduped.set(normalized.stepId, normalized);
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeProducer(input: DataLineageProducerReference): DataLineageProducerReference {
  return Object.freeze({
    assetId: normalizeId(input.assetId, "DataLineageProducerReference.assetId"),
    versionId: normalizeOptional(input.versionId),
    name: normalizeOptional(input.name),
  });
}

function normalizeExecution(input: DataLineageExecutionMarker): DataLineageExecutionMarker {
  return Object.freeze({
    executionId: normalizeId(input.executionId, "DataLineageExecutionMarker.executionId"),
    requestId: normalizeOptional(input.requestId),
    operationId: normalizeOptional(input.operationId),
    pipelineId: normalizeOptional(input.pipelineId),
    stageId: normalizeOptional(input.stageId),
    startedAt: normalizeId(input.startedAt, "DataLineageExecutionMarker.startedAt"),
    completedAt: normalizeOptional(input.completedAt),
  });
}

export function createDataLineageMetadata(input: {
  readonly schemaVersion?: string;
  readonly capturedAt: string;
  readonly producer: DataLineageProducerReference;
  readonly execution: DataLineageExecutionMarker;
  readonly inputs?: ReadonlyArray<DataLineageReference>;
  readonly steps?: ReadonlyArray<DataLineageExecutionStep>;
  readonly outputs?: ReadonlyArray<DataLineageReference>;
  readonly diagnostics?: ReadonlyArray<DataLineageDiagnosticNote>;
  readonly notes?: ReadonlyArray<string>;
  readonly attributes?: Readonly<Record<string, CanonicalRecordValue>>;
}): DataLineageMetadata {
  return Object.freeze({
    schemaVersion: normalizeOptional(input.schemaVersion) ?? "1.0.0",
    capturedAt: normalizeId(input.capturedAt, "DataLineageMetadata.capturedAt"),
    producer: normalizeProducer(input.producer),
    execution: normalizeExecution(input.execution),
    inputs: normalizeReferences(input.inputs),
    steps: normalizeSteps(input.steps),
    outputs: normalizeReferences(input.outputs),
    diagnostics: normalizeDiagnostics(input.diagnostics),
    notes: normalizeStringArray(input.notes),
    attributes: normalizeRecord(input.attributes),
  });
}
