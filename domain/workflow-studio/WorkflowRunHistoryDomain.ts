function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return Object.freeze(value) as T;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

function normalizeStructuredValue(value: unknown, label: string): unknown {
  try {
    return deepFreeze(JSON.parse(JSON.stringify(value)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown serialization error";
    throw new Error(`${label} must be JSON-serializable (${message}).`);
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, label: string): string {
  const normalized = normalizeRequired(value, label);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return normalized;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}

function normalizeTriggerSource(value?: string): WorkflowRunTriggerSource {
  switch (value?.trim()) {
    case WorkflowRunTriggerSources.manual:
      return WorkflowRunTriggerSources.manual;
    case WorkflowRunTriggerSources.schedule:
      return WorkflowRunTriggerSources.schedule;
    case WorkflowRunTriggerSources.event:
      return WorkflowRunTriggerSources.event;
    case WorkflowRunTriggerSources.api:
      return WorkflowRunTriggerSources.api;
    case WorkflowRunTriggerSources.system:
      return WorkflowRunTriggerSources.system;
    default:
      return WorkflowRunTriggerSources.unknown;
  }
}

function normalizeWorkflowRunStatus(value: string): WorkflowRunStatus {
  switch (value) {
    case WorkflowRunStatuses.queued:
    case WorkflowRunStatuses.running:
    case WorkflowRunStatuses.completed:
    case WorkflowRunStatuses.failed:
    case WorkflowRunStatuses.cancelled:
      return value;
    default:
      throw new Error(`Workflow run status '${value}' is not supported.`);
  }
}

function normalizeStepRunStatus(value: string): WorkflowStepRunStatus {
  switch (value) {
    case WorkflowStepRunStatuses.pending:
    case WorkflowStepRunStatuses.running:
    case WorkflowStepRunStatuses.completed:
    case WorkflowStepRunStatuses.failed:
    case WorkflowStepRunStatuses.cancelled:
    case WorkflowStepRunStatuses.skipped:
      return value;
    default:
      throw new Error(`Workflow step run status '${value}' is not supported.`);
  }
}

function normalizeDiagnosticCategory(value: string): WorkflowRunDiagnosticCategory {
  switch (value) {
    case WorkflowRunDiagnosticCategories.validation:
    case WorkflowRunDiagnosticCategories.configuration:
    case WorkflowRunDiagnosticCategories.dependency:
    case WorkflowRunDiagnosticCategories.runtime:
    case WorkflowRunDiagnosticCategories.outputDelivery:
    case WorkflowRunDiagnosticCategories.timeout:
    case WorkflowRunDiagnosticCategories.unknown:
      return value;
    default:
      return WorkflowRunDiagnosticCategories.unknown;
  }
}

function normalizeDiagnosticSeverity(value: string): WorkflowRunDiagnosticSeverity {
  switch (value) {
    case WorkflowRunDiagnosticSeverities.info:
    case WorkflowRunDiagnosticSeverities.warning:
    case WorkflowRunDiagnosticSeverities.error:
      return value;
    default:
      return WorkflowRunDiagnosticSeverities.error;
  }
}

function normalizeDiagnosticScope(value: string): WorkflowRunDiagnosticScope {
  switch (value) {
    case WorkflowRunDiagnosticScopes.workflow:
    case WorkflowRunDiagnosticScopes.step:
      return value;
    default:
      return WorkflowRunDiagnosticScopes.workflow;
  }
}

function normalizeDiagnosticLocation(
  location?: WorkflowRunDiagnosticLocation,
): WorkflowRunDiagnosticLocation | undefined {
  if (!location) {
    return undefined;
  }

  const stepId = normalizeOptional(location.stepId);
  const stepRunId = normalizeOptional(location.stepRunId);
  const stepName = normalizeOptional(location.stepName);
  const stepIndex = location.stepIndex === undefined
    ? undefined
    : normalizeNonNegativeInteger(location.stepIndex, "Workflow diagnostic stepIndex");

  if (stepId === undefined && stepRunId === undefined && stepName === undefined && stepIndex === undefined) {
    return undefined;
  }

  return Object.freeze({
    stepId,
    stepRunId,
    stepName,
    stepIndex,
  } satisfies WorkflowRunDiagnosticLocation);
}

function normalizeWorkflowRunDiagnostics(
  diagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>,
): ReadonlyArray<WorkflowRunDiagnosticRecord> | undefined {
  if (!diagnostics || diagnostics.length === 0) {
    return undefined;
  }

  const normalized: WorkflowRunDiagnosticRecord[] = [];
  const dedupeKeys = new Set<string>();

  for (const diagnostic of diagnostics) {
    const summary = normalizeOptional(diagnostic.summary);
    if (!summary) {
      continue;
    }

    const normalizedDiagnostic = Object.freeze({
      category: normalizeDiagnosticCategory(diagnostic.category),
      severity: normalizeDiagnosticSeverity(diagnostic.severity),
      scope: normalizeDiagnosticScope(diagnostic.scope),
      summary,
      code: normalizeOptional(diagnostic.code),
      technicalDetail: normalizeOptional(diagnostic.technicalDetail),
      remediationHint: normalizeOptional(diagnostic.remediationHint),
      location: normalizeDiagnosticLocation(diagnostic.location),
      unknownState: diagnostic.unknownState === true ? true : undefined,
    } satisfies WorkflowRunDiagnosticRecord);

    const key = [
      normalizedDiagnostic.scope,
      normalizedDiagnostic.category,
      normalizedDiagnostic.severity,
      normalizedDiagnostic.code ?? "",
      normalizedDiagnostic.summary,
      normalizedDiagnostic.location?.stepId ?? "",
      normalizedDiagnostic.location?.stepRunId ?? "",
    ].join("|");
    if (!dedupeKeys.has(key)) {
      dedupeKeys.add(key);
      normalized.push(normalizedDiagnostic);
    }
  }

  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

export const WorkflowRunStatuses = Object.freeze({
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type WorkflowRunStatus = typeof WorkflowRunStatuses[keyof typeof WorkflowRunStatuses];

export const WorkflowRunTriggerSources = Object.freeze({
  manual: "manual",
  schedule: "schedule",
  event: "event",
  api: "api",
  system: "system",
  unknown: "unknown",
});

export type WorkflowRunTriggerSource =
  typeof WorkflowRunTriggerSources[keyof typeof WorkflowRunTriggerSources];

export const WorkflowRunRerunModes = Object.freeze({
  asIs: "as-is",
  edited: "edited",
});

export type WorkflowRunRerunMode =
  typeof WorkflowRunRerunModes[keyof typeof WorkflowRunRerunModes];

export const WorkflowStepRunStatuses = Object.freeze({
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  skipped: "skipped",
});

export type WorkflowStepRunStatus =
  typeof WorkflowStepRunStatuses[keyof typeof WorkflowStepRunStatuses];

export const WorkflowRunDiagnosticCategories = Object.freeze({
  validation: "validation",
  configuration: "configuration",
  dependency: "dependency",
  runtime: "runtime",
  outputDelivery: "output-delivery",
  timeout: "timeout",
  unknown: "unknown",
});

export type WorkflowRunDiagnosticCategory =
  typeof WorkflowRunDiagnosticCategories[keyof typeof WorkflowRunDiagnosticCategories];

export const WorkflowRunDiagnosticSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

export type WorkflowRunDiagnosticSeverity =
  typeof WorkflowRunDiagnosticSeverities[keyof typeof WorkflowRunDiagnosticSeverities];

export const WorkflowRunDiagnosticScopes = Object.freeze({
  workflow: "workflow",
  step: "step",
});

export type WorkflowRunDiagnosticScope =
  typeof WorkflowRunDiagnosticScopes[keyof typeof WorkflowRunDiagnosticScopes];

export interface WorkflowRunDiagnosticLocation {
  readonly stepId?: string;
  readonly stepRunId?: string;
  readonly stepName?: string;
  readonly stepIndex?: number;
}

export interface WorkflowRunDiagnosticRecord {
  readonly category: WorkflowRunDiagnosticCategory;
  readonly severity: WorkflowRunDiagnosticSeverity;
  readonly scope: WorkflowRunDiagnosticScope;
  readonly summary: string;
  readonly code?: string;
  readonly technicalDetail?: string;
  readonly remediationHint?: string;
  readonly location?: WorkflowRunDiagnosticLocation;
  readonly unknownState?: boolean;
}

export interface WorkflowRunCorrelationIds {
  readonly executionRunId: string;
  readonly workflowExecutionId?: string;
  readonly executionFlowId?: string;
  readonly triggerEventId?: string;
  readonly parentRunId?: string;
  readonly rerunMode?: WorkflowRunRerunMode;
  readonly rerunReason?: string;
}

export interface WorkflowDefinitionReference {
  readonly workflowId: string;
  readonly workflowName: string;
  readonly definitionAssetId?: string;
  readonly definitionVersionId?: string;
}

export interface WorkflowRunOutputReference {
  readonly outputAssetIds: ReadonlyArray<string>;
  readonly outputCount: number;
}

function normalizeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

export interface WorkflowRunErrorSummary {
  readonly code?: string;
  readonly message: string;
  readonly detail?: string;
}

export interface WorkflowStepRunTimestamps {
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly updatedAt: string;
}

export interface WorkflowStepRunRecord {
  readonly stepRunId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly attempt: number;
  readonly stepName?: string;
  readonly stepType?: string;
  readonly actionType?: string;
  readonly status: WorkflowStepRunStatus;
  readonly timestamps: WorkflowStepRunTimestamps;
  readonly durationMs?: number;
  readonly summary?: string;
  readonly error?: WorkflowRunErrorSummary;
  readonly output?: WorkflowRunOutputReference;
  readonly diagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>;
  readonly metadata?: unknown;
}

export interface WorkflowRunTimestamps {
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly updatedAt: string;
}

export interface WorkflowStepRunStats {
  readonly totalCount: number;
  readonly pendingCount: number;
  readonly runningCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly cancelledCount: number;
  readonly skippedCount: number;
}

export interface WorkflowRunSummaryRecord {
  readonly runId: string;
  readonly status: WorkflowRunStatus;
  readonly triggerSource: WorkflowRunTriggerSource;
  readonly workflow: WorkflowDefinitionReference;
  readonly correlation: WorkflowRunCorrelationIds;
  readonly timestamps: WorkflowRunTimestamps;
  readonly output?: WorkflowRunOutputReference;
  readonly errorMessage?: string;
  readonly stepRunStats?: WorkflowStepRunStats;
  readonly diagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>;
}

export interface WorkflowRunExecutionContextRecord {
  readonly executionInput?: unknown;
  readonly resolvedTriggerContext?: unknown;
  readonly runtimeContext?: unknown;
}

export interface WorkflowRunOutputRecord {
  readonly outputAssetIds: ReadonlyArray<string>;
  readonly outputCount: number;
  readonly resultMessages?: ReadonlyArray<string>;
  readonly outputValues?: unknown;
}

export interface WorkflowRunDetailRecord {
  readonly runId: string;
  readonly summary: WorkflowRunSummaryRecord;
  readonly stepRuns: ReadonlyArray<WorkflowStepRunRecord>;
  readonly diagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>;
  readonly executionContext?: WorkflowRunExecutionContextRecord;
  readonly outputs?: WorkflowRunOutputRecord;
}

export interface CreateWorkflowRunSummaryInput {
  readonly runId: string;
  readonly status: WorkflowRunStatus;
  readonly triggerSource?: WorkflowRunTriggerSource;
  readonly workflow: WorkflowDefinitionReference;
  readonly correlation: WorkflowRunCorrelationIds;
  readonly timestamps: {
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly updatedAt?: string;
  };
  readonly output?: {
    readonly outputAssetIds?: ReadonlyArray<string>;
    readonly outputCount?: number;
  };
  readonly errorMessage?: string;
  readonly stepRunStats?: WorkflowStepRunStats;
  readonly diagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>;
}

export interface CreateWorkflowRunDetailInput {
  readonly runId: string;
  readonly summary: WorkflowRunSummaryRecord;
  readonly stepRuns?: ReadonlyArray<WorkflowStepRunRecord>;
  readonly diagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>;
  readonly executionContext?: WorkflowRunExecutionContextRecord;
  readonly outputs?: WorkflowRunOutputRecord;
}

function normalizeOutputReference(
  output?: CreateWorkflowRunSummaryInput["output"] | WorkflowRunOutputReference,
): WorkflowRunOutputReference | undefined {
  if (!output) {
    return undefined;
  }

  const outputAssetIds = normalizeStringList(output.outputAssetIds);
  const outputCount = output.outputCount ?? outputAssetIds.length;

  if (!Number.isInteger(outputCount) || outputCount < outputAssetIds.length || outputCount < 0) {
    throw new Error("Workflow run outputCount must be a non-negative integer greater than or equal to outputAssetIds length.");
  }

  if (outputAssetIds.length === 0 && outputCount === 0) {
    return undefined;
  }

  return Object.freeze({
    outputAssetIds,
    outputCount,
  } satisfies WorkflowRunOutputReference);
}

export function normalizeWorkflowStepRunRecord(stepRun: WorkflowStepRunRecord): WorkflowStepRunRecord {
  const startedAt = stepRun.timestamps.startedAt
    ? normalizeIsoTimestamp(stepRun.timestamps.startedAt, "Workflow step run startedAt")
    : undefined;
  const endedAt = stepRun.timestamps.endedAt
    ? normalizeIsoTimestamp(stepRun.timestamps.endedAt, "Workflow step run endedAt")
    : undefined;
  const updatedAt = normalizeIsoTimestamp(stepRun.timestamps.updatedAt, "Workflow step run updatedAt");

  if (startedAt && endedAt && Date.parse(endedAt) < Date.parse(startedAt)) {
    throw new Error("Workflow step run endedAt must be at or after startedAt.");
  }
  if (startedAt && Date.parse(updatedAt) < Date.parse(startedAt)) {
    throw new Error("Workflow step run updatedAt must be at or after startedAt.");
  }

  const durationMs = stepRun.durationMs
    ?? (startedAt && endedAt ? Date.parse(endedAt) - Date.parse(startedAt) : undefined);
  if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs < 0)) {
    throw new Error("Workflow step run durationMs must be a non-negative finite number.");
  }

  const errorMessage = normalizeOptional(stepRun.error?.message);
  const error = errorMessage
    ? Object.freeze({
      code: normalizeOptional(stepRun.error?.code),
      message: errorMessage,
      detail: normalizeOptional(stepRun.error?.detail),
    } satisfies WorkflowRunErrorSummary)
    : undefined;

  return Object.freeze({
    stepRunId: normalizeRequired(stepRun.stepRunId, "Workflow step run id"),
    stepId: normalizeRequired(stepRun.stepId, "Workflow step id"),
    stepIndex: normalizeNonNegativeInteger(stepRun.stepIndex, "Workflow step run stepIndex"),
    attempt: normalizePositiveInteger(stepRun.attempt, "Workflow step run attempt"),
    stepName: normalizeOptional(stepRun.stepName),
    stepType: normalizeOptional(stepRun.stepType),
    actionType: normalizeOptional(stepRun.actionType),
    status: normalizeStepRunStatus(stepRun.status),
    timestamps: Object.freeze({
      startedAt,
      endedAt,
      updatedAt,
    } satisfies WorkflowStepRunTimestamps),
    durationMs,
    summary: normalizeOptional(stepRun.summary),
    error,
    output: normalizeOutputReference(stepRun.output),
    diagnostics: normalizeWorkflowRunDiagnostics(stepRun.diagnostics),
    metadata: stepRun.metadata === undefined
      ? undefined
      : normalizeStructuredValue(stepRun.metadata, "Workflow step run metadata"),
  } satisfies WorkflowStepRunRecord);
}

function normalizeWorkflowReference(reference: WorkflowDefinitionReference): WorkflowDefinitionReference {
  const definitionVersionId = normalizeOptional(reference.definitionVersionId);
  if (definitionVersionId && !definitionVersionId.startsWith("version:")) {
    throw new Error("Workflow definition version id must use canonical 'version:' prefix when provided.");
  }

  return Object.freeze({
    workflowId: normalizeRequired(reference.workflowId, "Workflow id"),
    workflowName: normalizeRequired(reference.workflowName, "Workflow name"),
    definitionAssetId: normalizeOptional(reference.definitionAssetId),
    definitionVersionId,
  } satisfies WorkflowDefinitionReference);
}

function normalizeCorrelation(correlation: WorkflowRunCorrelationIds): WorkflowRunCorrelationIds {
  const rerunMode = correlation.rerunMode?.trim();
  let normalizedRerunMode: WorkflowRunRerunMode | undefined;
  if (rerunMode === WorkflowRunRerunModes.asIs) {
    normalizedRerunMode = WorkflowRunRerunModes.asIs;
  } else if (rerunMode === WorkflowRunRerunModes.edited) {
    normalizedRerunMode = WorkflowRunRerunModes.edited;
  }

  return Object.freeze({
    executionRunId: normalizeRequired(correlation.executionRunId, "Workflow run execution run id"),
    workflowExecutionId: normalizeOptional(correlation.workflowExecutionId),
    executionFlowId: normalizeOptional(correlation.executionFlowId),
    triggerEventId: normalizeOptional(correlation.triggerEventId),
    parentRunId: normalizeOptional(correlation.parentRunId),
    rerunMode: normalizedRerunMode,
    rerunReason: normalizeOptional(correlation.rerunReason),
  } satisfies WorkflowRunCorrelationIds);
}

function normalizeStepRunStats(stats: WorkflowStepRunStats): WorkflowStepRunStats {
  const normalized = Object.freeze({
    totalCount: stats.totalCount,
    pendingCount: stats.pendingCount,
    runningCount: stats.runningCount,
    completedCount: stats.completedCount,
    failedCount: stats.failedCount,
    cancelledCount: stats.cancelledCount,
    skippedCount: stats.skippedCount,
  } satisfies WorkflowStepRunStats);

  const fields = [
    normalized.totalCount,
    normalized.pendingCount,
    normalized.runningCount,
    normalized.completedCount,
    normalized.failedCount,
    normalized.cancelledCount,
    normalized.skippedCount,
  ];
  if (!fields.every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("Workflow step run stats fields must be non-negative integers.");
  }
  const totalWithoutPending = normalized.runningCount
    + normalized.completedCount
    + normalized.failedCount
    + normalized.cancelledCount
    + normalized.skippedCount
    + normalized.pendingCount;
  if (normalized.totalCount !== totalWithoutPending) {
    throw new Error("Workflow step run stats totalCount must match the sum of status counts.");
  }
  return normalized;
}

export function createWorkflowStepRunStats(stepRuns: ReadonlyArray<WorkflowStepRunRecord>): WorkflowStepRunStats {
  const counts = {
    totalCount: stepRuns.length,
    pendingCount: 0,
    runningCount: 0,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    skippedCount: 0,
  };

  for (const stepRun of stepRuns) {
    switch (stepRun.status) {
      case WorkflowStepRunStatuses.pending:
        counts.pendingCount += 1;
        break;
      case WorkflowStepRunStatuses.running:
        counts.runningCount += 1;
        break;
      case WorkflowStepRunStatuses.completed:
        counts.completedCount += 1;
        break;
      case WorkflowStepRunStatuses.failed:
        counts.failedCount += 1;
        break;
      case WorkflowStepRunStatuses.cancelled:
        counts.cancelledCount += 1;
        break;
      case WorkflowStepRunStatuses.skipped:
        counts.skippedCount += 1;
        break;
      default:
        break;
    }
  }

  return normalizeStepRunStats(counts);
}

function classifyWorkflowDiagnosticCategory(code?: string, message?: string): WorkflowRunDiagnosticCategory {
  const normalized = `${code ?? ""} ${message ?? ""}`.toLowerCase();
  if (normalized.includes("validation")) {
    return WorkflowRunDiagnosticCategories.validation;
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return WorkflowRunDiagnosticCategories.timeout;
  }
  if (normalized.includes("output") && normalized.includes("delivery")) {
    return WorkflowRunDiagnosticCategories.outputDelivery;
  }
  if (normalized.includes("dependency") || normalized.includes("unavailable") || normalized.includes("missing")) {
    return WorkflowRunDiagnosticCategories.dependency;
  }
  if (normalized.includes("unsupported") || normalized.includes("configuration") || normalized.includes("config")) {
    return WorkflowRunDiagnosticCategories.configuration;
  }
  if (normalized.trim().length === 0) {
    return WorkflowRunDiagnosticCategories.unknown;
  }
  return WorkflowRunDiagnosticCategories.runtime;
}

function resolveWorkflowDiagnosticRemediationHint(category: WorkflowRunDiagnosticCategory): string {
  switch (category) {
    case WorkflowRunDiagnosticCategories.validation:
      return "Review workflow inputs and step configuration, then rerun.";
    case WorkflowRunDiagnosticCategories.configuration:
      return "Review authored workflow and runtime configuration before rerun.";
    case WorkflowRunDiagnosticCategories.dependency:
      return "Verify referenced assets/services are available and version-compatible.";
    case WorkflowRunDiagnosticCategories.outputDelivery:
      return "Inspect output destination settings and delivery targets.";
    case WorkflowRunDiagnosticCategories.timeout:
      return "Increase timeout or reduce workload, then retry.";
    case WorkflowRunDiagnosticCategories.runtime:
      return "Inspect step diagnostics and runtime context, then retry.";
    default:
      return "Inspect technical details and runtime events, then retry.";
  }
}

export function deriveWorkflowRunDiagnostics(input: {
  readonly status: WorkflowRunStatus;
  readonly errorMessage?: string;
  readonly stepRuns?: ReadonlyArray<WorkflowStepRunRecord>;
  readonly existingDiagnostics?: ReadonlyArray<WorkflowRunDiagnosticRecord>;
}): ReadonlyArray<WorkflowRunDiagnosticRecord> | undefined {
  const diagnostics: WorkflowRunDiagnosticRecord[] = [];

  if (input.existingDiagnostics) {
    diagnostics.push(...input.existingDiagnostics);
  }

  if (input.errorMessage?.trim()) {
    const category = classifyWorkflowDiagnosticCategory(undefined, input.errorMessage);
    diagnostics.push({
      category,
      severity: input.status === WorkflowRunStatuses.cancelled
        ? WorkflowRunDiagnosticSeverities.warning
        : WorkflowRunDiagnosticSeverities.error,
      scope: WorkflowRunDiagnosticScopes.workflow,
      summary: input.errorMessage,
      remediationHint: resolveWorkflowDiagnosticRemediationHint(category),
    });
  }

  for (const stepRun of input.stepRuns ?? []) {
    if (stepRun.status !== WorkflowStepRunStatuses.failed || !stepRun.error?.message) {
      continue;
    }
    const category = classifyWorkflowDiagnosticCategory(stepRun.error.code, stepRun.error.message);
    diagnostics.push({
      category,
      severity: WorkflowRunDiagnosticSeverities.error,
      scope: WorkflowRunDiagnosticScopes.step,
      summary: stepRun.error.message,
      code: stepRun.error.code,
      technicalDetail: stepRun.error.detail,
      remediationHint: resolveWorkflowDiagnosticRemediationHint(category),
      location: {
        stepId: stepRun.stepId,
        stepRunId: stepRun.stepRunId,
        stepName: stepRun.stepName,
        stepIndex: stepRun.stepIndex,
      },
    });
  }

  if (input.status === WorkflowRunStatuses.failed && diagnostics.length === 0) {
    diagnostics.push({
      category: WorkflowRunDiagnosticCategories.unknown,
      severity: WorkflowRunDiagnosticSeverities.error,
      scope: WorkflowRunDiagnosticScopes.workflow,
      summary: "Run failed without structured failure details.",
      remediationHint: resolveWorkflowDiagnosticRemediationHint(WorkflowRunDiagnosticCategories.unknown),
      unknownState: true,
    });
  }

  return normalizeWorkflowRunDiagnostics(diagnostics);
}

export function createWorkflowRunSummaryRecord(input: CreateWorkflowRunSummaryInput): WorkflowRunSummaryRecord {
  const startedAt = normalizeIsoTimestamp(input.timestamps.startedAt, "Workflow run startedAt");
  const endedAt = input.timestamps.endedAt
    ? normalizeIsoTimestamp(input.timestamps.endedAt, "Workflow run endedAt")
    : undefined;
  const updatedAt = input.timestamps.updatedAt
    ? normalizeIsoTimestamp(input.timestamps.updatedAt, "Workflow run updatedAt")
    : endedAt ?? startedAt;

  if (Date.parse(updatedAt) < Date.parse(startedAt)) {
    throw new Error("Workflow run updatedAt must be at or after startedAt.");
  }
  if (endedAt && Date.parse(endedAt) < Date.parse(startedAt)) {
    throw new Error("Workflow run endedAt must be at or after startedAt.");
  }

  const status = normalizeWorkflowRunStatus(input.status);
  if ((status === WorkflowRunStatuses.completed || status === WorkflowRunStatuses.failed || status === WorkflowRunStatuses.cancelled) && !endedAt) {
    throw new Error(`Workflow run status '${status}' requires endedAt.`);
  }
  if ((status === WorkflowRunStatuses.queued || status === WorkflowRunStatuses.running) && endedAt) {
    throw new Error(`Workflow run status '${status}' cannot include endedAt.`);
  }

  const stepRunStats = input.stepRunStats
    ? normalizeStepRunStats(input.stepRunStats)
    : undefined;
  const diagnostics = normalizeWorkflowRunDiagnostics(input.diagnostics);

  return Object.freeze({
    runId: normalizeRequired(input.runId, "Workflow run id"),
    status,
    triggerSource: normalizeTriggerSource(input.triggerSource),
    workflow: normalizeWorkflowReference(input.workflow),
    correlation: normalizeCorrelation(input.correlation),
    timestamps: Object.freeze({
      startedAt,
      endedAt,
      updatedAt,
    } satisfies WorkflowRunTimestamps),
    output: normalizeOutputReference(input.output),
    errorMessage: normalizeOptional(input.errorMessage),
    stepRunStats,
    diagnostics,
  } satisfies WorkflowRunSummaryRecord);
}

function normalizeResultMessages(messages?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!messages) {
    return undefined;
  }

  const normalized = messages
    .map((message) => message.trim())
    .filter((message) => message.length > 0);
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeExecutionContext(
  context?: WorkflowRunExecutionContextRecord,
): WorkflowRunExecutionContextRecord | undefined {
  if (!context) {
    return undefined;
  }

  const executionInput = context.executionInput === undefined
    ? undefined
    : normalizeStructuredValue(context.executionInput, "Workflow execution input context");
  const resolvedTriggerContext = context.resolvedTriggerContext === undefined
    ? undefined
    : normalizeStructuredValue(context.resolvedTriggerContext, "Workflow resolved trigger context");
  const runtimeContext = context.runtimeContext === undefined
    ? undefined
    : normalizeStructuredValue(context.runtimeContext, "Workflow runtime context");

  if (executionInput === undefined && resolvedTriggerContext === undefined && runtimeContext === undefined) {
    return undefined;
  }

  return Object.freeze({
    executionInput,
    resolvedTriggerContext,
    runtimeContext,
  } satisfies WorkflowRunExecutionContextRecord);
}

function normalizeOutputRecord(
  output?: WorkflowRunOutputRecord,
): WorkflowRunOutputRecord | undefined {
  if (!output) {
    return undefined;
  }

  const outputAssetIds = normalizeStringList(output.outputAssetIds);
  const outputCount = output.outputCount ?? outputAssetIds.length;

  if (!Number.isInteger(outputCount) || outputCount < outputAssetIds.length || outputCount < 0) {
    throw new Error("Workflow run output record outputCount must be a non-negative integer greater than or equal to outputAssetIds length.");
  }

  const outputValues = output.outputValues === undefined
    ? undefined
    : normalizeStructuredValue(output.outputValues, "Workflow run output values");
  const resultMessages = normalizeResultMessages(output.resultMessages);

  if (outputCount === 0 && outputValues === undefined && !resultMessages) {
    return undefined;
  }

  return Object.freeze({
    outputAssetIds,
    outputCount,
    resultMessages,
    outputValues,
  } satisfies WorkflowRunOutputRecord);
}

export function createWorkflowRunDetailRecord(input: CreateWorkflowRunDetailInput): WorkflowRunDetailRecord {
  const runId = normalizeRequired(input.runId, "Workflow run detail id");
  const summary = normalizeWorkflowRunSummaryRecord(input.summary);
  if (summary.runId !== runId) {
    throw new Error("Workflow run detail runId must match summary runId.");
  }

  const stepRuns = Object.freeze((input.stepRuns ?? []).map((stepRun) => normalizeWorkflowStepRunRecord(stepRun)));
  const diagnostics = input.diagnostics
    ? normalizeWorkflowRunDiagnostics(input.diagnostics)
    : deriveWorkflowRunDiagnostics({
      status: summary.status,
      errorMessage: summary.errorMessage,
      stepRuns,
      existingDiagnostics: summary.diagnostics,
    });
  return Object.freeze({
    runId,
    summary: Object.freeze({
      ...summary,
      stepRunStats: createWorkflowStepRunStats(stepRuns),
      diagnostics,
    }),
    stepRuns,
    diagnostics,
    executionContext: normalizeExecutionContext(input.executionContext),
    outputs: normalizeOutputRecord(input.outputs),
  } satisfies WorkflowRunDetailRecord);
}

export interface WorkflowRunSummaryListQuery {
  readonly workflowId?: string;
  readonly status?: WorkflowRunStatus;
  readonly triggerSource?: WorkflowRunTriggerSource;
  readonly startedAfter?: string;
  readonly startedBefore?: string;
  readonly limit?: number;
}

export function normalizeWorkflowRunSummaryRecord(record: WorkflowRunSummaryRecord): WorkflowRunSummaryRecord {
  return createWorkflowRunSummaryRecord({
    runId: record.runId,
    status: record.status,
    triggerSource: record.triggerSource,
    workflow: record.workflow,
    correlation: record.correlation,
    timestamps: record.timestamps,
    output: record.output,
    errorMessage: record.errorMessage,
    stepRunStats: record.stepRunStats,
    diagnostics: record.diagnostics,
  });
}

export function normalizeWorkflowRunDetailRecord(record: WorkflowRunDetailRecord): WorkflowRunDetailRecord {
  return createWorkflowRunDetailRecord({
    runId: record.runId,
    summary: record.summary,
    stepRuns: record.stepRuns,
    diagnostics: record.diagnostics,
    executionContext: record.executionContext,
    outputs: record.outputs,
  });
}
