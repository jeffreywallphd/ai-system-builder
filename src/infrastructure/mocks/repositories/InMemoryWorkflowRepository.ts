import type { IWorkflow } from "../../../src/domain/workflows/interfaces/IWorkflow";
import type { IWorkflowRecordSummary, IWorkflowRepository } from "../../../application/ports/interfaces/IWorkflowRepository";
import { WorkflowMetadata } from "../../../src/domain/workflows/WorkflowMetadata";

export class InMemoryWorkflowRepository implements IWorkflowRepository {
  private readonly workflows = new Map<string, IWorkflow>();

  constructor(initialWorkflows: ReadonlyArray<IWorkflow> = []) {
    for (const workflow of initialWorkflows) {
      this.workflows.set(workflow.id, workflow);
    }
  }

  public async save(workflow: IWorkflow): Promise<IWorkflow> {
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    return this.workflows.get(id.trim());
  }

  public async delete(id: string): Promise<void> {
    this.workflows.delete(id.trim());
  }

  public async exists(id: string): Promise<boolean> {
    return this.workflows.has(id.trim());
  }

  public async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    return Object.freeze(
      [...this.workflows.values()].map((workflow) => ({
        id: workflow.id,
        metadata: new WorkflowMetadata(workflow.metadata),
        status: workflow.status,
        isEnabled: workflow.isEnabled,
        provider: "in-memory",
        updatedAt: workflow.audit?.updatedAt,
      }))
    );
  }
}
