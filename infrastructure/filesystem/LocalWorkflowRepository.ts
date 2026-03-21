import path from "node:path";
import type {
  IWorkflowRecordSummary,
  IWorkflowRepository,
} from "../../application/ports/interfaces/IWorkflowRepository";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import type { INodeCatalogProvider } from "../../application/ports/interfaces/INodeCatalogProvider";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import { WorkflowPersistenceCodec, type WorkflowRecord } from "../workflows/WorkflowPersistenceCodec";

export class LocalWorkflowRepository implements IWorkflowRepository {
  private readonly codec = new WorkflowPersistenceCodec();
  private readonly fileStorage: IFileStorage;
  private readonly nodeCatalogProvider: INodeCatalogProvider;
  private readonly rootDirectory: string;

  constructor(params: {
    fileStorage: IFileStorage;
    nodeCatalogProvider: INodeCatalogProvider;
    rootDirectory: string;
  }) {
    this.fileStorage = params.fileStorage;
    this.nodeCatalogProvider = params.nodeCatalogProvider;
    this.rootDirectory = params.rootDirectory.trim();
  }

  public async save(workflow: IWorkflow): Promise<IWorkflow> {
    const filePath = this.resolveWorkflowPath(workflow.id);
    const record = this.codec.toRecord(workflow);

    await this.fileStorage.write({
      path: filePath,
      content: JSON.stringify(record, null, 2),
      createDirectories: true,
      overwrite: true,
    });

    return workflow;
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    const workflowId = id.trim();
    const filePath = this.resolveWorkflowPath(workflowId);

    if (!(await this.fileStorage.exists(filePath))) {
      return undefined;
    }

    const content = await this.fileStorage.readText(filePath, "utf-8");
    const record = JSON.parse(content) as WorkflowRecord;

    return this.codec.toDomain(record, this.nodeCatalogProvider);
  }

  public async delete(id: string): Promise<void> {
    const workflowId = id.trim();
    const filePath = this.resolveWorkflowPath(workflowId);

    if (!(await this.fileStorage.exists(filePath))) {
      return;
    }

    await this.fileStorage.delete(filePath);
  }

  public async exists(id: string): Promise<boolean> {
    const workflowId = id.trim();
    return this.fileStorage.exists(this.resolveWorkflowPath(workflowId));
  }

  public async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    const info = await this.fileStorage.stat(this.rootDirectory);

    if (info.kind === "missing") {
      return Object.freeze([]);
    }

    const entries = await this.fileStorage.list(this.rootDirectory, {
      recursive: false,
      includeHidden: false,
    });

    const workflows: IWorkflowRecordSummary[] = [];

    for (const entry of entries) {
      if (entry.kind !== "file" || !entry.path.endsWith(".json")) {
        continue;
      }

      const content = await this.fileStorage.readText(entry.path, "utf-8");
      const record = JSON.parse(content) as WorkflowRecord;
      workflows.push(this.codec.toSummary(record));
    }

    return Object.freeze(
      workflows.sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
    );
  }

  private resolveWorkflowPath(id: string): string {
    const workflowId = id.trim();

    if (!workflowId) {
      throw new Error("Workflow ID cannot be empty.");
    }

    return path.join(this.rootDirectory, `${workflowId}.json`);
  }
}
