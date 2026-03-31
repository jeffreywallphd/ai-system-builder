import type { IWorkflowExecutionInput, IWorkflowExecutionResult } from "../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowRunSummaryRepository } from "../ports/interfaces/IWorkflowRunSummaryRepository";
import {
  createWorkflowRunDetailRecord,
  createWorkflowStepRunStats,
  deriveWorkflowRunDiagnostics,
  createWorkflowRunSummaryRecord,
  normalizeWorkflowStepRunRecord,
  normalizeWorkflowRunDetailRecord,
  normalizeWorkflowRunSummaryRecord,
  WorkflowStepRunStatuses,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
  type WorkflowRunDetailRecord,
  type WorkflowRunErrorSummary,
  type WorkflowStepRunRecord,
  type WorkflowStepRunStatus,
  type WorkflowRunExecutionContextRecord,
  type WorkflowRunDiagnosticRecord,
  type WorkflowRunOutputRecord,
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

export interface RecordWorkflowStepEventRequest {
  readonly runId: string;
  readonly workflow: IWorkflowExecutionInput["workflow"];
  readonly event: {
    readonly kind: string;
    readonly nodeId?: string;
    readonly message?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  };
}

function cloneJsonSafe(value: unknown): unknown {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function extractExecutionContext(input: IWorkflowExecutionInput): WorkflowRunExecutionContextRecord | undefined {
  const executionInput = cloneJsonSafe({
    target: input.target,
    parameters: input.parameters,
    executionMetadata: input.executionMetadata,
    propertyOverrides: input.propertyOverrides,
    inputAssetIds: (input.inputAssets ?? []).map((asset) => asset.id),
  });

  const triggerMetadata = (input.parameters ?? {}) as Record<string, unknown>;
  const resolvedTriggerContext = cloneJsonSafe({
    triggerSource: typeof triggerMetadata.triggerSource === "string" ? triggerMetadata.triggerSource : undefined,
    triggerEventId: typeof triggerMetadata.triggerEventId === "string" ? triggerMetadata.triggerEventId : undefined,
    triggerActivation: triggerMetadata.triggerActivation,
    triggerContext: triggerMetadata.triggerContext,
  });

  const runtimeContext = cloneJsonSafe(input.executionMetadata);
  if (!executionInput && !resolvedTriggerContext && !runtimeContext) {
    return undefined;
  }

  return Object.freeze({
    executionInput,
    resolvedTriggerContext,
    runtimeContext,
  });
}

function extractOutputRecord(result: IWorkflowExecutionResult): WorkflowRunOutputRecord {
  const outputAssetIds = result.outputAssets
    .map((asset) => asset.id)
    .filter((id): id is string => typeof id === "string");

  return Object.freeze({
    outputAssetIds,
    outputCount: outputAssetIds.length,
    resultMessages: result.messages,
    outputValues: cloneJsonSafe({
      status: result.status,
      executionId: result.executionId,
      errorMessage: result.errorMessage,
    }),
  });
}

function normalizeStepEventStatus(kind: string): WorkflowStepRunStatus | undefined {
  switch (kind) {
    case "node-started":
      return WorkflowStepRunStatuses.running;
    case "node-progress":
      return WorkflowStepRunStatuses.running;
    case "node-completed":
      return WorkflowStepRunStatuses.completed;
    case "node-failed":
      return WorkflowStepRunStatuses.failed;
    default:
      return undefined;
  }
}

function toStructuredError(message?: string, payload?: Readonly<Record<string, unknown>>): WorkflowRunErrorSummary | undefined {
  const normalized = message?.trim();
  if (!normalized) {
    return undefined;
  }
  return Object.freeze({
    code: typeof payload?.code === "string" ? payload.code : undefined,
    message: normalized,
    detail: typeof payload?.detail === "string" ? payload.detail : undefined,
  });
}

export class WorkflowRunHistoryService {
  constructor(
    private readonly repository: IWorkflowRunSummaryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async recordRunStarted(request: RecordWorkflowRunStartRequest): Promise<WorkflowRunSummaryRecord> {
    const runId = normalizeRequired(request.runId, "Workflow run id");
    const startedAt = this.now().toISOString();

    const summary = createWorkflowRunSummaryRecord({
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
      stepRunStats: createWorkflowStepRunStats([]),
    });

    await this.tryRepository("record-start:upsert-summary", () => this.repository.upsert(summary));
    const detail = createWorkflowRunDetailRecord({
      runId,
      summary,
      stepRuns: [],
      executionContext: extractExecutionContext(request.input),
    });
    await this.tryRepository("record-start:upsert-detail", () => this.repository.upsertDetail(detail));
    return summary;
  }

  public async recordRunCompleted(request: RecordWorkflowRunCompletionRequest): Promise<WorkflowRunSummaryRecord> {
    const runId = normalizeRequired(request.runId, "Workflow run id");
    const existingDetail = await this.tryRepository("record-complete:load-existing-detail", () => this.repository.getDetailByRunId(runId));
    const existing = existingDetail?.summary
      ?? await this.tryRepository("record-complete:load-existing", () => this.repository.getByRunId(runId));
    if (!existing) {
      throw new WorkflowRunHistoryNotFoundError(runId);
    }

    const endedAt = this.now().toISOString();
    const stepRuns = this.finalizeOpenStepRuns(
      existingDetail?.stepRuns ?? [],
      request.result.status === WorkflowRunStatuses.cancelled ? WorkflowStepRunStatuses.cancelled : undefined,
      endedAt,
    );
    const outputRecord = extractOutputRecord(request.result);

    const summary = createWorkflowRunSummaryRecord({
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
        outputAssetIds: outputRecord.outputAssetIds,
        outputCount: outputRecord.outputCount,
      },
      errorMessage: request.result.errorMessage,
      stepRunStats: createWorkflowStepRunStats(stepRuns),
      diagnostics: deriveWorkflowRunDiagnostics({
        status: request.result.status,
        errorMessage: request.result.errorMessage,
        stepRuns,
      }),
    });

    await this.tryRepository("record-complete:upsert-summary", () => this.repository.upsert(summary));
    const detail = createWorkflowRunDetailRecord({
      runId,
      summary,
      stepRuns,
      diagnostics: summary.diagnostics,
      executionContext: existingDetail?.executionContext,
      outputs: outputRecord,
    });
    await this.tryRepository("record-complete:upsert-detail", () => this.repository.upsertDetail(detail));
    return summary;
  }

  public async recordRunFailed(request: RecordWorkflowRunFailureRequest): Promise<WorkflowRunSummaryRecord> {
    const runId = normalizeRequired(request.runId, "Workflow run id");
    const existingDetail = await this.tryRepository("record-failed:load-existing-detail", () => this.repository.getDetailByRunId(runId));
    const existing = existingDetail?.summary
      ?? await this.tryRepository("record-failed:load-existing", () => this.repository.getByRunId(runId));
    if (!existing) {
      throw new WorkflowRunHistoryNotFoundError(runId);
    }

    const endedAt = this.now().toISOString();
    const stepRuns = this.finalizeOpenStepRuns(
      existingDetail?.stepRuns ?? [],
      WorkflowStepRunStatuses.cancelled,
      endedAt,
    );

    const summary = createWorkflowRunSummaryRecord({
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
      stepRunStats: createWorkflowStepRunStats(stepRuns),
      diagnostics: deriveWorkflowRunDiagnostics({
        status: WorkflowRunStatuses.failed,
        errorMessage: request.errorMessage,
        stepRuns,
      }),
    });

    await this.tryRepository("record-failed:upsert-summary", () => this.repository.upsert(summary));
    const detail = createWorkflowRunDetailRecord({
      runId,
      summary,
      stepRuns,
      diagnostics: summary.diagnostics,
      executionContext: existingDetail?.executionContext,
      outputs: existingDetail?.outputs,
    });
    await this.tryRepository("record-failed:upsert-detail", () => this.repository.upsertDetail(detail));
    return summary;
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

  public async getRunDetail(runId: string): Promise<WorkflowRunDetailRecord | undefined> {
    const normalized = normalizeRequired(runId, "Workflow run id");
    return this.tryRepository("get-detail", async () => {
      const detail = await this.repository.getDetailByRunId(normalized);
      return detail ? normalizeWorkflowRunDetailRecord(detail) : undefined;
    });
  }

  public async recordStepEvent(request: RecordWorkflowStepEventRequest): Promise<WorkflowRunDetailRecord | undefined> {
    const runId = normalizeRequired(request.runId, "Workflow run id");
    const nodeId = request.event.nodeId?.trim();
    if (!nodeId) {
      return this.getRunDetail(runId);
    }

    const status = normalizeStepEventStatus(request.event.kind);
    if (!status) {
      return this.getRunDetail(runId);
    }

    const existing = await this.tryRepository("record-step:load-existing-detail", () => this.repository.getDetailByRunId(runId));
    if (!existing) {
      return undefined;
    }

    const nowIso = this.now().toISOString();
    const stepRuns = [...existing.stepRuns];
    const stepIndex = this.resolveStepIndex(request.workflow, nodeId);
    const stepMetadata = this.resolveStepMetadata(request.workflow, nodeId);
    const activeIndex = stepRuns.findIndex((stepRun) =>
      stepRun.stepId === nodeId
      && (stepRun.status === WorkflowStepRunStatuses.pending || stepRun.status === WorkflowStepRunStatuses.running),
    );
    const attempt = activeIndex >= 0
      ? stepRuns[activeIndex]!.attempt
      : stepRuns.filter((stepRun) => stepRun.stepId === nodeId).length + 1;
    const nextStatus = status;
    const current = activeIndex >= 0 ? stepRuns[activeIndex] : undefined;
    const startedAt = current?.timestamps.startedAt
      ?? (nextStatus === WorkflowStepRunStatuses.running || nextStatus === WorkflowStepRunStatuses.completed || nextStatus === WorkflowStepRunStatuses.failed
        ? nowIso
        : undefined);
    const endedAt = nextStatus === WorkflowStepRunStatuses.completed || nextStatus === WorkflowStepRunStatuses.failed
      ? nowIso
      : undefined;

    const nextStepRun = this.normalizeStepRun({
      stepRunId: `${runId}:${nodeId}:${attempt}`,
      stepId: nodeId,
      stepIndex,
      attempt,
      stepName: stepMetadata.stepName,
      stepType: stepMetadata.stepType,
      actionType: stepMetadata.actionType,
      status: nextStatus,
      timestamps: {
        startedAt,
        endedAt,
        updatedAt: nowIso,
      },
      summary: request.event.message,
      error: nextStatus === WorkflowStepRunStatuses.failed
        ? toStructuredError(request.event.message, request.event.payload)
        : undefined,
      diagnostics: nextStatus === WorkflowStepRunStatuses.failed
        ? this.toStepEventDiagnostics({
          stepRunId: `${runId}:${nodeId}:${attempt}`,
          stepId: nodeId,
          stepIndex,
          stepName: stepMetadata.stepName,
          message: request.event.message,
          payload: request.event.payload,
        })
        : undefined,
      metadata: request.event.payload,
    });

    if (activeIndex >= 0) {
      stepRuns[activeIndex] = nextStepRun;
    } else {
      stepRuns.push(nextStepRun);
    }
    stepRuns.sort((left, right) => {
      const indexDelta = left.stepIndex - right.stepIndex;
      if (indexDelta !== 0) {
        return indexDelta;
      }
      return left.attempt - right.attempt;
    });

    const summary = createWorkflowRunSummaryRecord({
      ...existing.summary,
      timestamps: {
        startedAt: existing.summary.timestamps.startedAt,
        endedAt: existing.summary.timestamps.endedAt,
        updatedAt: nowIso,
      },
      stepRunStats: createWorkflowStepRunStats(stepRuns),
      diagnostics: deriveWorkflowRunDiagnostics({
        status: existing.summary.status,
        errorMessage: existing.summary.errorMessage,
        stepRuns,
      }),
    });
    const detail = createWorkflowRunDetailRecord({
      runId,
      summary,
      stepRuns,
      diagnostics: summary.diagnostics,
      executionContext: existing.executionContext,
      outputs: existing.outputs,
    });
    await this.tryRepository("record-step:upsert-detail", () => this.repository.upsertDetail(detail));
    await this.tryRepository("record-step:upsert-summary", () => this.repository.upsert(summary));
    return detail;
  }

  private async tryRepository<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw toWorkflowRunHistoryError(operation, error);
    }
  }

  private finalizeOpenStepRuns(
    stepRuns: ReadonlyArray<WorkflowStepRunRecord>,
    terminalStatus: WorkflowStepRunStatus | undefined,
    terminalTime: string,
  ): ReadonlyArray<WorkflowStepRunRecord> {
    return Object.freeze(stepRuns.map((stepRun) => {
      if (stepRun.status !== WorkflowStepRunStatuses.pending && stepRun.status !== WorkflowStepRunStatuses.running) {
        return stepRun;
      }

      const status = terminalStatus ?? stepRun.status;
      return this.normalizeStepRun({
        ...stepRun,
        status,
        timestamps: {
          startedAt: stepRun.timestamps.startedAt,
          endedAt: status === WorkflowStepRunStatuses.pending || status === WorkflowStepRunStatuses.running
            ? undefined
            : terminalTime,
          updatedAt: terminalTime,
        },
        summary: stepRun.summary,
      });
    }));
  }

  private resolveStepIndex(workflow: IWorkflowExecutionInput["workflow"], nodeId: string): number {
    const indexByNodeId = new Map<string, number>();
    for (const [index, node] of workflow.nodes.entries()) {
      indexByNodeId.set(node.id, index);
    }

    const sortedNodes = workflow.toGraph().topologicalSort();
    for (const [index, node] of sortedNodes.entries()) {
      indexByNodeId.set(node.id, index);
    }

    return indexByNodeId.get(nodeId) ?? indexByNodeId.size;
  }

  private resolveStepMetadata(
    workflow: IWorkflowExecutionInput["workflow"],
    nodeId: string,
  ): { readonly stepName?: string; readonly stepType?: string; readonly actionType?: string } {
    const node = workflow.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return {};
    }
    return Object.freeze({
      stepName: node.title || node.definition.title,
      stepType: node.definition.type,
      actionType: node.definition.executionKind,
    });
  }

  private normalizeStepRun(stepRun: WorkflowStepRunRecord): WorkflowStepRunRecord {
    return normalizeWorkflowStepRunRecord(stepRun);
  }

  private toStepEventDiagnostics(input: {
    readonly stepRunId: string;
    readonly stepId: string;
    readonly stepIndex: number;
    readonly stepName?: string;
    readonly message?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  }): ReadonlyArray<WorkflowRunDiagnosticRecord> | undefined {
    const message = input.message?.trim();
    if (!message) {
      return undefined;
    }

    const rawCode = typeof input.payload?.code === "string"
      ? input.payload.code.toLowerCase()
      : undefined;
    const category = rawCode?.includes("validation")
      ? "validation"
      : rawCode?.includes("timeout")
        ? "timeout"
        : rawCode?.includes("dependency")
          ? "dependency"
          : rawCode?.includes("output")
            ? "output-delivery"
            : "runtime";

    return Object.freeze([Object.freeze({
      category,
      severity: "error",
      scope: "step",
      summary: message,
      code: typeof input.payload?.code === "string" ? input.payload.code : undefined,
      technicalDetail: typeof input.payload?.detail === "string" ? input.payload.detail : undefined,
      remediationHint: "Inspect this step configuration and runtime context, then rerun.",
      location: {
        stepId: input.stepId,
        stepRunId: input.stepRunId,
        stepName: input.stepName,
        stepIndex: input.stepIndex,
      },
    } satisfies WorkflowRunDiagnosticRecord)]);
  }
}
