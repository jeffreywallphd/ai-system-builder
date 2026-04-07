import type {
  ITransformationInput,
  ITransformationOutput,
  TransformationAssetPreviewContract,
  TransformationPreviewChangeSummary,
  TransformationPreviewIssue,
  TransformationPreviewRowSample,
} from "./TransformationContracts";
import { TransformationPreviewIssueSeverities } from "./TransformationContracts";
import type { TransformationPipelinePreviewResult, TransformationPipelinePreviewStep } from "./TransformationPipeline";
import { TransformationAssetPreviewContractSchema, TransformationPipelinePreviewContractSchema } from "./TransformationPreviewContracts";
import { createStructuredJsonDiffPatch } from "./TransformationDiffUtils";

interface InspectableRow {
  readonly rowId: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

function toInspectableRows(data: ITransformationInput["data"]): ReadonlyArray<InspectableRow> {
  if (data.kind === "records") {
    return Object.freeze(data.records.map((record) => Object.freeze({
      rowId: record.recordId,
      fields: record.fields,
    })));
  }
  return Object.freeze(data.rows.map((row) => Object.freeze({
    rowId: row.rowId,
    fields: row.cells,
  })));
}

function toPreviewRows(rows: ReadonlyArray<InspectableRow>, maxRows: number): ReadonlyArray<TransformationPreviewRowSample> {
  const normalizedMaxRows = Math.max(1, maxRows);
  return Object.freeze(rows.slice(0, normalizedMaxRows).map((row) => Object.freeze({
    rowId: row.rowId,
    fields: row.fields,
  })));
}

function toStableComparable(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function deriveChangedFields(
  beforeRows: ReadonlyArray<InspectableRow>,
  afterRows: ReadonlyArray<InspectableRow>,
): ReadonlyArray<string> {
  const beforeById = new Map<string, Readonly<Record<string, unknown>>>();
  for (const row of beforeRows) {
    beforeById.set(row.rowId, row.fields);
  }

  const fieldNames = new Set<string>();
  for (const after of afterRows) {
    const before = beforeById.get(after.rowId);
    if (!before) {
      for (const key of Object.keys(after.fields)) {
        fieldNames.add(key);
      }
      continue;
    }
    const allKeys = new Set<string>([...Object.keys(before), ...Object.keys(after.fields)]);
    for (const key of allKeys) {
      if (toStableComparable(before[key]) !== toStableComparable(after.fields[key])) {
        fieldNames.add(key);
      }
    }
  }
  return Object.freeze([...fieldNames].sort((left, right) => left.localeCompare(right)));
}

function buildChangeSummary(
  inputData: ITransformationInput["data"],
  outputData: ITransformationOutput["data"],
  sampledInputRows: ReadonlyArray<InspectableRow>,
  sampledOutputRows: ReadonlyArray<InspectableRow>,
): TransformationPreviewChangeSummary {
  const inputRows = toInspectableRows(inputData);
  const outputRows = toInspectableRows(outputData);
  const inputRowIds = new Set(inputRows.map((row) => row.rowId));
  const outputRowIds = new Set(outputRows.map((row) => row.rowId));

  let removedRowCount = 0;
  for (const rowId of inputRowIds) {
    if (!outputRowIds.has(rowId)) {
      removedRowCount += 1;
    }
  }

  let addedRowCount = 0;
  for (const rowId of outputRowIds) {
    if (!inputRowIds.has(rowId)) {
      addedRowCount += 1;
    }
  }

  const changedFields = deriveChangedFields(sampledInputRows, sampledOutputRows);
  let changedRowCount = 0;
  const sampledOutputById = new Map(sampledOutputRows.map((row) => [row.rowId, row.fields]));
  for (const sampledBefore of sampledInputRows) {
    const sampledAfter = sampledOutputById.get(sampledBefore.rowId);
    if (!sampledAfter) {
      continue;
    }
    const allKeys = new Set<string>([...Object.keys(sampledBefore.fields), ...Object.keys(sampledAfter)]);
    const changed = [...allKeys].some((key) => toStableComparable(sampledBefore.fields[key]) !== toStableComparable(sampledAfter[key]));
    if (changed) {
      changedRowCount += 1;
    }
  }

  return Object.freeze({
    inputRowCount: inputRows.length,
    outputRowCount: outputRows.length,
    sampledInputRowCount: sampledInputRows.length,
    sampledOutputRowCount: sampledOutputRows.length,
    changedRowCount,
    addedRowCount,
    removedRowCount,
    changedFieldCount: changedFields.length,
    changedFields,
  });
}

function truncateUnknown(input: unknown, depth: number = 0): unknown {
  const maxDepth = 5;
  const maxEntries = 12;
  if (depth >= maxDepth) {
    return "[truncated]";
  }
  if (Array.isArray(input)) {
    return Object.freeze(input.slice(0, maxEntries).map((entry) => truncateUnknown(entry, depth + 1)));
  }
  if (!input || typeof input !== "object") {
    return input;
  }
  const normalized: Record<string, unknown> = {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, maxEntries);
  for (const [key, value] of entries) {
    normalized[key] = truncateUnknown(value, depth + 1);
  }
  return Object.freeze(normalized);
}

function deriveWarningsAndDiagnostics(output: ITransformationOutput): {
  readonly warnings: ReadonlyArray<TransformationPreviewIssue>;
  readonly diagnostics: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly extensions: Readonly<Record<string, unknown>>;
} {
  const omittedKeys = new Set(["data", "metadata", "sampleRows"]);
  const outputRecord = output as unknown as Record<string, unknown>;
  const extensionEntries = Object.entries(outputRecord)
    .filter(([key]) => !omittedKeys.has(key));
  const extensions = Object.freeze(Object.fromEntries(extensionEntries.map(([key, value]) => [key, truncateUnknown(value)])));
  const diagnostics = Object.freeze(extensionEntries.map(([key, value]) => Object.freeze({
    key,
    summary: `Asset-specific diagnostic payload: ${key}.`,
    payload: truncateUnknown(value),
  })));

  const warnings: TransformationPreviewIssue[] = [];
  for (const [key, value] of extensionEntries) {
    const lowerKey = key.toLocaleLowerCase();
    if ((lowerKey.includes("skipped") || lowerKey.includes("invalid") || lowerKey.includes("failed")) && Array.isArray(value) && value.length > 0) {
      warnings.push(Object.freeze({
        severity: TransformationPreviewIssueSeverities.warning,
        code: `diagnostic:${key}`,
        message: `${key} reported ${value.length} item(s).`,
      }));
    }
    if ((lowerKey.includes("skipped") || lowerKey.includes("invalid") || lowerKey.includes("failed")) && typeof value === "number" && value > 0) {
      warnings.push(Object.freeze({
        severity: TransformationPreviewIssueSeverities.warning,
        code: `diagnostic:${key}`,
        message: `${key} reported ${value}.`,
      }));
    }
  }

  return Object.freeze({
    warnings: Object.freeze(warnings),
    diagnostics,
    extensions,
  });
}

export function buildTransformationAssetPreviewContract(input: {
  readonly input: ITransformationInput;
  readonly output: ITransformationOutput;
  readonly maxSampleRows?: number;
}): TransformationAssetPreviewContract {
  const maxSampleRows = Math.max(1, input.maxSampleRows ?? 25);
  const sampledInputRows = toInspectableRows(input.input.data);
  const sampledOutputRows = toInspectableRows(input.output.data);
  const summary = buildChangeSummary(input.input.data, input.output.data, sampledInputRows, sampledOutputRows);
  const diffPatch = createStructuredJsonDiffPatch(
    toPreviewRows(sampledInputRows, maxSampleRows),
    toPreviewRows(sampledOutputRows, maxSampleRows),
  );
  const derived = deriveWarningsAndDiagnostics(input.output);

  const contract = Object.freeze({
    contractVersion: "1.0.0" as const,
    generatedAt: new Date().toISOString(),
    asset: Object.freeze({
      assetId: input.output.metadata.assetId,
      assetVersion: input.output.metadata.assetVersion,
    }),
    summary,
    samples: Object.freeze({
      inputRows: toPreviewRows(sampledInputRows, maxSampleRows),
      outputRows: toPreviewRows(sampledOutputRows, maxSampleRows),
    }),
    diffs: diffPatch ? Object.freeze({
      structuredPatch: diffPatch,
    }) : undefined,
    diagnostics: derived.diagnostics,
    warnings: derived.warnings,
    errors: Object.freeze([]),
    extensions: derived.extensions,
  });

  return TransformationAssetPreviewContractSchema.parse(contract);
}

function normalizeStepIssues(step: TransformationPipelinePreviewStep): {
  readonly warnings: ReadonlyArray<TransformationPreviewIssue>;
  readonly errors: ReadonlyArray<TransformationPreviewIssue>;
} {
  const errors: TransformationPreviewIssue[] = [];
  if (step.error) {
    errors.push(Object.freeze({
      severity: TransformationPreviewIssueSeverities.error,
      code: step.error.name,
      message: step.error.message,
      path: step.error.issues?.[0]?.path,
    }));
  }
  return Object.freeze({
    warnings: Object.freeze([
      ...step.warningMessages.map((entry, index) => Object.freeze({
        severity: TransformationPreviewIssueSeverities.warning,
        code: `pipeline-warning-${index + 1}`,
        message: entry,
      })),
      ...(step.preview?.warnings ?? []),
    ]),
    errors: Object.freeze([
      ...errors,
      ...(step.preview?.errors ?? []),
    ]),
  });
}

function collectStepWarnings(step: TransformationPipelinePreviewStep): ReadonlyArray<TransformationPreviewIssue> {
  return Object.freeze(step.warningMessages.map((entry, index) => Object.freeze({
      severity: TransformationPreviewIssueSeverities.warning,
      code: `pipeline-warning-${index + 1}`,
      message: entry,
    })));
}

export function buildTransformationPipelinePreviewContract(
  preview: TransformationPipelinePreviewResult,
) {
  const changedFields = new Set<string>();
  let totalChangedRows = 0;
  let totalAddedRows = 0;
  let totalRemovedRows = 0;
  let warningCount = 0;
  let errorCount = 0;

  const normalizedSteps = preview.steps.map((step) => {
    const normalizedIssues = normalizeStepIssues(step);
    warningCount += normalizedIssues.warnings.length;
    errorCount += normalizedIssues.errors.length;
    const stepSummary = step.preview?.summary;
    if (stepSummary) {
      totalChangedRows += stepSummary.changedRowCount;
      totalAddedRows += stepSummary.addedRowCount;
      totalRemovedRows += stepSummary.removedRowCount;
      for (const field of stepSummary.changedFields) {
        changedFields.add(field);
      }
    }
    return Object.freeze({
      stepId: step.stepId,
      assetId: step.assetId,
      assetVersion: step.assetVersion,
      status: step.status,
      summary: stepSummary,
      warnings: normalizedIssues.warnings,
      errors: normalizedIssues.errors,
      preview: step.preview,
    });
  });

  const warnings: TransformationPreviewIssue[] = [];
  for (const step of preview.steps) {
    warnings.push(...collectStepWarnings(step));
  }
  const errors: TransformationPreviewIssue[] = [];
  if (preview.error) {
    errors.push(Object.freeze({
      severity: TransformationPreviewIssueSeverities.error,
      code: preview.error.name,
      message: preview.error.message,
      path: preview.error.issues?.[0]?.path,
    }));
  }

  const contract = Object.freeze({
    contractVersion: "1.0.0" as const,
    generatedAt: new Date().toISOString(),
    pipelineId: preview.pipelineId,
    status: preview.status,
    failureMode: preview.failureMode,
    inputSummary: preview.inputSummary,
    outputSummary: preview.outputSummary,
    finalPreviewData: preview.finalPreviewData,
    steps: Object.freeze(normalizedSteps),
    summary: Object.freeze({
      stepCount: preview.steps.length,
      succeededStepCount: preview.steps.filter((step) => step.status === "succeeded").length,
      failedStepCount: preview.steps.filter((step) => step.status === "failed").length,
      warningCount,
      errorCount: errorCount + errors.length,
      totalChangedRows,
      totalAddedRows,
      totalRemovedRows,
      changedFields: Object.freeze([...changedFields].sort((left, right) => left.localeCompare(right))),
    }),
    warnings: Object.freeze(warnings),
    errors: Object.freeze(errors),
  });

  return TransformationPipelinePreviewContractSchema.parse(contract);
}
