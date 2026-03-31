function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
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

export interface WorkflowRunCorrelationIds {
  readonly executionRunId: string;
  readonly workflowExecutionId?: string;
  readonly executionFlowId?: string;
  readonly triggerEventId?: string;
  readonly parentRunId?: string;
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

export interface WorkflowStepRunRecord {
  readonly stepRunId: string;
  readonly stepId: string;
  readonly stepName?: string;
  readonly stepType?: string;
  readonly status: WorkflowStepRunStatus;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly errorMessage?: string;
  readonly output?: WorkflowRunOutputReference;
}

export interface WorkflowRunTimestamps {
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly updatedAt: string;
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
  readonly stepRuns?: ReadonlyArray<WorkflowStepRunRecord>;
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
  readonly stepRuns?: ReadonlyArray<WorkflowStepRunRecord>;
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

function normalizeStepRunRecord(stepRun: WorkflowStepRunRecord): WorkflowStepRunRecord {
  const startedAt = stepRun.startedAt ? normalizeIsoTimestamp(stepRun.startedAt, "Workflow step run startedAt") : undefined;
  const endedAt = stepRun.endedAt ? normalizeIsoTimestamp(stepRun.endedAt, "Workflow step run endedAt") : undefined;

  if (startedAt && endedAt && Date.parse(endedAt) < Date.parse(startedAt)) {
    throw new Error("Workflow step run endedAt must be at or after startedAt.");
  }

  return Object.freeze({
    stepRunId: normalizeRequired(stepRun.stepRunId, "Workflow step run id"),
    stepId: normalizeRequired(stepRun.stepId, "Workflow step id"),
    stepName: normalizeOptional(stepRun.stepName),
    stepType: normalizeOptional(stepRun.stepType),
    status: normalizeStepRunStatus(stepRun.status),
    startedAt,
    endedAt,
    errorMessage: normalizeOptional(stepRun.errorMessage),
    output: normalizeOutputReference(stepRun.output),
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
  return Object.freeze({
    executionRunId: normalizeRequired(correlation.executionRunId, "Workflow run execution run id"),
    workflowExecutionId: normalizeOptional(correlation.workflowExecutionId),
    executionFlowId: normalizeOptional(correlation.executionFlowId),
    triggerEventId: normalizeOptional(correlation.triggerEventId),
    parentRunId: normalizeOptional(correlation.parentRunId),
  } satisfies WorkflowRunCorrelationIds);
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

  const stepRuns = input.stepRuns?.map((stepRun) => normalizeStepRunRecord(stepRun));

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
    stepRuns: stepRuns ? Object.freeze(stepRuns) : undefined,
  } satisfies WorkflowRunSummaryRecord);
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
    stepRuns: record.stepRuns,
  });
}
