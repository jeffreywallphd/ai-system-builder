import type { DesktopWorkflowBridge } from "../../../electron/shared/DesktopContracts";
import type { IWorkflowRecordSummary, IWorkflowRepository } from "../../../application/ports/interfaces/IWorkflowRepository";
import type { INodeCatalogProvider } from "../../../application/ports/interfaces/INodeCatalogProvider";
import type { IWorkflow } from "../../../src/domain/workflows/interfaces/IWorkflow";
import { WorkflowPersistenceCodec, type WorkflowRecord } from "../../workflows/WorkflowPersistenceCodec";

export class DesktopBridgeWorkflowRepository implements IWorkflowRepository {
  private readonly codec = new WorkflowPersistenceCodec();

  constructor(
    private readonly nodeCatalogProvider: INodeCatalogProvider,
    private readonly bridge: DesktopWorkflowBridge,
  ) {}

  public async save(workflow: IWorkflow): Promise<IWorkflow> {
    const record = this.codec.toRecord(workflow);
    this.bridge.saveWorkflowRecord(JSON.stringify(record));
    return workflow;
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    const raw = this.bridge.loadWorkflowRecord(id.trim());
    if (!raw) {
      return undefined;
    }

    return this.codec.toDomain(JSON.parse(raw) as WorkflowRecord, this.nodeCatalogProvider);
  }

  public async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    return Object.freeze(
      this.bridge.listWorkflowSummaries().map((value) => JSON.parse(value) as IWorkflowRecordSummary)
    );
  }

  public async delete(id: string): Promise<void> {
    this.bridge.deleteWorkflowRecord(id.trim());
  }

  public async exists(id: string): Promise<boolean> {
    return this.bridge.workflowExists(id.trim());
  }
}
