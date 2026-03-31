import type { IWorkflowExecutionInput, IWorkflowExecutionResult } from "../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowRunSummaryRepository } from "../ports/interfaces/IWorkflowRunSummaryRepository";
import {
  createWorkflowRunSummaryRecord,
  normalizeWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
  type WorkflowRunSummaryListQuery,
  type WorkflowRunSummaryRecord,
  type WorkflowRunTriggerSource,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import {
  toWorkflowRunHistoryError,
  WorkflowRunHistoryInvalidRequestError,
  WorkflowRunHistoryNotFoundError,
} from "./WorkflowRunHistoryErrors";

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new WorkflowRunHistoryInvalidRequestError(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveTriggerSource(input: IWorkflowExecutionInput): WorkflowRunTriggerSource {
  const explicit = typeof input.parameters?.triggerSource === "string"
    ? input.parameters.triggerSource.trim()
    : undefined;

  switch (explicit) {
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
    case WorkflowRunTriggerSources.unknown:
      return WorkflowRunTriggerSources.unknown;
    default:
      return WorkflowRunTriggerSources.manual;
  }
}

export interface RecordWorkflowRunStartRequest {
  readonly runId: string;
  readonly executionFlowId?: string;
  readonly input: IWorkflowExecutionInput;
}

export interface RecordWorkflowRunCompletionRequest {
  readonly runId: string;
  readonly result: IWorkflowExecutionResult;
}

export interface RecordWorkflowRunFailureRequest {
  readonly runId: string;
  readonly errorMessage: string;
}

export class WorkflowRunHistoryService {
  constructor(
    private readonly repository: IWorkflowRunSummaryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async recordRunStarted(request: RecordWorkflowRunStartRequest): Promise<WorkflowRunSummaryRecord> {
    const runId = normalizeRequired(request.runId, "Workflow run id");
    const startedAt = this.now().toISOString();

    const record = createWorkflowRunSummaryRecord({
      runId,
      status: WorkflowRunStatuses.running,
      triggerSource: resolveTriggerSource(request.input),
      workflow: {
        workflowId: request.input.workflow.id,
        workflowName: request.input.workflow.metadata.name,
        definitionAssetId: typeof request.input.parameters?.workflowDefinitionAssetId === "string"
          ? request.input.parameters.workflowDefinitionAssetId
          : undefined,
        definitionVersionId: typeof request.input.parameters?.workflowDefinitionVersionId === "string"
          ? request.input.parameters.workflowDefinitionVersionId
          : undefined,
      },
      correlation: {
        executionRunId: runId,
        executionFlowId: normalizeOptional(request.executionFlowId),
        triggerEventId: typeof request.input.parameters?.triggerEventId === "string"
          ? request.input.parameters.triggerEventId
          : undefined,
        parentRunId: typeof request.input.parameters?.parentRunId === "string"
          ? request.input.parameters.parentRunId
          : undefined,
      },
      timestamps: {
        startedAt,
        updatedAt: startedAt,
      },
    });

    return this.tryRepository("record-start:upsert", () => this.repository.upsert(record));
  }

  public async recordRunCompleted(request: RecordWorkflowRunCompletionRequest): Promise<WorkflowRunSummaryRecord> {
    const runId = normalizeRequired(request.runId, "Workflow run id");
    const existing = await this.tryRepository("record-complete:load-existing", () => this.repository.getByRunId(runId));
    if (!existing) {
      throw new WorkflowRunHistoryNotFoundError(runId);
    }

    const endedAt = this.now().toISOString();
    const outputAssetIds = request.result.outputAssets.map((asset) => asset.id).filter((id) => typeof id === "string");

    const updated = createWorkflowRunSummaryRecord({
      runId: existing.runId,
      status: request.result.status,
      triggerSource: existing.triggerSource,
      workflow: existing.workflow,
      correlation: {
        ...existing.correlation,
        workflowExecutionId: request.result.executionId,
      },
      timestamps: {
        startedAt: existing.timestamps.startedAt,
        endedAt,
        updatedAt: endedAt,
      },
      output: {
        outputAssetIds,
        outputCount: outputAssetIds.length,
      },
      errorMessage: request.result.errorMessage,
      stepRuns: existing.stepRuns,
    });

    return this.tryRepository("record-complete:upsert", () => this.repository.upsert(updated));
  }

  public async recordRunFailed(request: RecordWorkflowRunFailureRequest): Promise<WorkflowRunSummaryRecord> {
    const runId = normalizeRequired(request.runId, "Workflow run id");
    const existing = await this.tryRepository("record-failed:load-existing", () => this.repository.getByRunId(runId));
    if (!existing) {
      throw new WorkflowRunHistoryNotFoundError(runId);
    }

    const endedAt = this.now().toISOString();
    const failed = createWorkflowRunSummaryRecord({
      runId: existing.runId,
      status: WorkflowRunStatuses.failed,
      triggerSource: existing.triggerSource,
      workflow: existing.workflow,
      correlation: existing.correlation,
      timestamps: {
        startedAt: existing.timestamps.startedAt,
        endedAt,
        updatedAt: endedAt,
      },
      output: existing.output,
      errorMessage: normalizeRequired(request.errorMessage, "Workflow run failure message"),
      stepRuns: existing.stepRuns,
    });

    return this.tryRepository("record-failed:upsert", () => this.repository.upsert(failed));
  }

  public async getRunSummary(runId: string): Promise<WorkflowRunSummaryRecord | undefined> {
    const normalized = normalizeRequired(runId, "Workflow run id");
    return this.tryRepository("get-summary", () => this.repository.getByRunId(normalized));
  }

  public async listRunSummaries(query?: WorkflowRunSummaryListQuery): Promise<ReadonlyArray<WorkflowRunSummaryRecord>> {
    return this.tryRepository("list-summaries", async () => {
      const listed = await this.repository.list(query);
      return Object.freeze(listed.map((record) => normalizeWorkflowRunSummaryRecord(record)));
    });
  }

  private async tryRepository<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw toWorkflowRunHistoryError(operation, error);
    }
  }
}
