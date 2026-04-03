import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { WorkflowOutputMaterializationPayload } from "./WorkflowOutputMaterializationContract";

export interface WorkflowOutputProvenanceRecord {
  readonly provenanceId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: WorkflowOutputMaterializationPayload["status"];
  readonly systemId: string;
  readonly datasetInstanceId: string;
  readonly materializationId: string;
  readonly workflowRunId: string;
  readonly workflowAssetId: string;
  readonly workflowAssetVersionId?: string;
  readonly outputRecordId: string;
  readonly outputAssetStableId: string;
  readonly outputRole: WorkflowOutputMaterializationPayload["producedAssets"][number]["role"];
  readonly outputIndex: number;
  readonly outputGroupId: string;
  readonly sourceImageStableIds: ReadonlyArray<string>;
  readonly parameterSnapshot: Readonly<Record<string, CanonicalRecordValue>>;
  readonly executionContext: Readonly<Record<string, CanonicalRecordValue>>;
  readonly capabilityContext: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface WorkflowOutputProvenanceQuery {
  readonly systemId?: string;
  readonly datasetInstanceId?: string;
  readonly workflowRunId?: string;
  readonly workflowAssetId?: string;
  readonly outputAssetStableId?: string;
  readonly outputGroupId?: string;
  readonly status?: WorkflowOutputMaterializationPayload["status"];
  readonly limit?: number;
}

export interface WorkflowOutputProvenanceRepository {
  save(record: WorkflowOutputProvenanceRecord): void;
  listByWorkflowRunId(workflowRunId: string, limit?: number): ReadonlyArray<WorkflowOutputProvenanceRecord>;
  listByOutputAssetStableId(outputAssetStableId: string, limit?: number): ReadonlyArray<WorkflowOutputProvenanceRecord>;
  query(query?: WorkflowOutputProvenanceQuery): ReadonlyArray<WorkflowOutputProvenanceRecord>;
}

export class InMemoryWorkflowOutputProvenanceRepository implements WorkflowOutputProvenanceRepository {
  private readonly records: WorkflowOutputProvenanceRecord[] = [];

  public constructor(private readonly maxRecords = 20_000) {}

  public save(record: WorkflowOutputProvenanceRecord): void {
    const existing = this.records.findIndex((entry) => entry.provenanceId === record.provenanceId);
    if (existing >= 0) {
      this.records.splice(existing, 1, record);
    } else {
      this.records.push(record);
    }
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  public listByWorkflowRunId(workflowRunId: string, limit?: number): ReadonlyArray<WorkflowOutputProvenanceRecord> {
    return this.query({ workflowRunId, limit });
  }

  public listByOutputAssetStableId(outputAssetStableId: string, limit?: number): ReadonlyArray<WorkflowOutputProvenanceRecord> {
    return this.query({ outputAssetStableId, limit });
  }

  public query(query: WorkflowOutputProvenanceQuery = {}): ReadonlyArray<WorkflowOutputProvenanceRecord> {
    const filtered = this.records.filter((entry) => {
      if (query.systemId && entry.systemId !== query.systemId.trim()) return false;
      if (query.datasetInstanceId && entry.datasetInstanceId !== query.datasetInstanceId.trim()) return false;
      if (query.workflowRunId && entry.workflowRunId !== query.workflowRunId.trim()) return false;
      if (query.workflowAssetId && entry.workflowAssetId !== query.workflowAssetId.trim()) return false;
      if (query.outputAssetStableId && entry.outputAssetStableId !== query.outputAssetStableId.trim()) return false;
      if (query.outputGroupId && entry.outputGroupId !== query.outputGroupId.trim()) return false;
      if (query.status && entry.status !== query.status) return false;
      return true;
    }).sort((a, b) => {
      const byCreatedAt = a.createdAt.localeCompare(b.createdAt);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }
      const byGroup = a.outputGroupId.localeCompare(b.outputGroupId);
      if (byGroup !== 0) {
        return byGroup;
      }
      return a.outputIndex - b.outputIndex;
    });

    const limit = typeof query.limit === "number" && Number.isFinite(query.limit)
      ? Math.max(1, Math.floor(query.limit))
      : undefined;
    const bounded = limit ? filtered.slice(Math.max(0, filtered.length - limit)) : filtered;
    return Object.freeze([...bounded]);
  }
}
