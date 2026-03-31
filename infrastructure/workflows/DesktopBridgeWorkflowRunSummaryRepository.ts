import type { IWorkflowRunSummaryRepository } from "../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import type {
  WorkflowRunDetailRecord,
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import {
  createWorkflowRunDetailRecord,
  createWorkflowStepRunStats,
  normalizeWorkflowRunSummaryRecord,
  normalizeWorkflowRunDetailRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import type { DesktopWorkflowRunSummaryBridge } from "../../electron/shared/DesktopContracts";

export class DesktopBridgeWorkflowRunSummaryRepository implements IWorkflowRunSummaryRepository {
  constructor(private readonly bridge: DesktopWorkflowRunSummaryBridge) {}

  public async upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord> {
    const normalized = normalizeWorkflowRunSummaryRecord(record);
    await this.bridge.saveWorkflowRunSummary(JSON.stringify(normalized));
    return normalized;
  }

  public async upsertDetail(record: WorkflowRunDetailRecord): Promise<WorkflowRunDetailRecord> {
    const normalized = normalizeWorkflowRunDetailRecord(record);
    if (typeof this.bridge.saveWorkflowRunDetail === "function") {
      await this.bridge.saveWorkflowRunDetail(JSON.stringify(normalized));
    } else {
      await this.bridge.saveWorkflowRunSummary(JSON.stringify(normalized.summary));
    }
    return normalized;
  }

  public async getByRunId(runId: string): Promise<WorkflowRunSummaryRecord | undefined> {
    const raw = await this.bridge.loadWorkflowRunSummary(runId.trim());
    return raw ? normalizeWorkflowRunSummaryRecord(JSON.parse(raw) as WorkflowRunSummaryRecord) : undefined;
  }

  public async list(query?: WorkflowRunSummaryListQuery): Promise<ReadonlyArray<WorkflowRunSummaryRecord>> {
    const raw = await this.bridge.listWorkflowRunSummaries(query ? JSON.stringify(query) : undefined);
    return Object.freeze(raw.map((entry) => normalizeWorkflowRunSummaryRecord(JSON.parse(entry) as WorkflowRunSummaryRecord)));
  }

  public async getDetailByRunId(runId: string): Promise<WorkflowRunDetailRecord | undefined> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return undefined;
    }

    if (typeof this.bridge.loadWorkflowRunDetail === "function") {
      const raw = await this.bridge.loadWorkflowRunDetail(normalizedRunId);
      return raw ? normalizeWorkflowRunDetailRecord(JSON.parse(raw) as WorkflowRunDetailRecord) : undefined;
    }

    const summary = await this.getByRunId(normalizedRunId);
    if (!summary) {
      return undefined;
    }
    return createWorkflowRunDetailRecord({
      runId: summary.runId,
      summary: normalizeWorkflowRunSummaryRecord({
        ...summary,
        stepRunStats: summary.stepRunStats ?? createWorkflowStepRunStats([]),
      }),
      stepRuns: [],
    });
  }
}
