import type { IWorkflowRunSummaryRepository } from "../../application/ports/interfaces/IWorkflowRunSummaryRepository";
import type {
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import { normalizeWorkflowRunSummaryRecord } from "../../domain/workflow-studio/WorkflowRunHistoryDomain";
import type { DesktopWorkflowRunSummaryBridge } from "../../electron/shared/DesktopContracts";

export class DesktopBridgeWorkflowRunSummaryRepository implements IWorkflowRunSummaryRepository {
  constructor(private readonly bridge: DesktopWorkflowRunSummaryBridge) {}

  public async upsert(record: WorkflowRunSummaryRecord): Promise<WorkflowRunSummaryRecord> {
    const normalized = normalizeWorkflowRunSummaryRecord(record);
    await this.bridge.saveWorkflowRunSummary(JSON.stringify(normalized));
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
}
