import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import type { IWorkflowRepository } from "../../../ui/services/WorkflowService";

export class InMemoryWorkflowRepository implements IWorkflowRepository {
  private readonly workflows = new Map<string, IWorkflow>();

  constructor(initialWorkflows: ReadonlyArray<IWorkflow> = []) {
    for (const workflow of initialWorkflows) {
      this.workflows.set(workflow.id, workflow);
    }
  }

  public async save(workflow: IWorkflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    return this.workflows.get(id.trim());
  }

  public async list(): Promise<ReadonlyArray<IWorkflow>> {
    return Object.freeze([...this.workflows.values()]);
  }

  public async delete(id: string): Promise<boolean> {
    return this.workflows.delete(id.trim());
  }
}
