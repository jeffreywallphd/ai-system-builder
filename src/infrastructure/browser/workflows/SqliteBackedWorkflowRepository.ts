import type { IWorkflowRepository, IWorkflowRecordSummary } from "@application/ports/interfaces/IWorkflowRepository";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { INodeCatalogProvider } from "@application/ports/interfaces/INodeCatalogProvider";
import { WorkflowPersistenceCodec, type WorkflowRecord } from "../../workflows/WorkflowPersistenceCodec";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "ai-loom-studio.workflows.browser-storage";

export class BrowserStorageWorkflowRepository implements IWorkflowRepository {
  private readonly codec = new WorkflowPersistenceCodec();

  constructor(
    private readonly nodeCatalogProvider: INodeCatalogProvider,
    private readonly storage: StorageLike,
    initialWorkflows: ReadonlyArray<IWorkflow> = [],
  ) {
    if (initialWorkflows.length > 0 && this.readRecords().size === 0) {
      const records = new Map<string, WorkflowRecord>();
      for (const workflow of initialWorkflows) {
        records.set(workflow.id, this.codec.toRecord(workflow));
      }
      this.writeRecords(records);
    }
  }

  public async save(workflow: IWorkflow): Promise<IWorkflow> {
    const records = this.readRecords();
    records.set(workflow.id, this.codec.toRecord(workflow));
    this.writeRecords(records);
    return workflow;
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    const record = this.readRecords().get(id.trim());
    return record ? this.codec.toDomain(record, this.nodeCatalogProvider) : undefined;
  }

  public async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    return Object.freeze(
      [...this.readRecords().values()]
        .map((record) => this.codec.toSummary(record, "browser-storage-fallback"))
        .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
    );
  }

  public async delete(id: string): Promise<void> {
    const records = this.readRecords();
    records.delete(id.trim());
    this.writeRecords(records);
  }

  public async exists(id: string): Promise<boolean> {
    return this.readRecords().has(id.trim());
  }

  private readRecords(): Map<string, WorkflowRecord> {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Map<string, WorkflowRecord>();
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<WorkflowRecord>;
      return new Map(parsed.map((record) => [record.id, record]));
    } catch {
      return new Map<string, WorkflowRecord>();
    }
  }

  private writeRecords(records: Map<string, WorkflowRecord>): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify([...records.values()], null, 2));
  }
}

export class SqliteBackedWorkflowRepository extends BrowserStorageWorkflowRepository {}

