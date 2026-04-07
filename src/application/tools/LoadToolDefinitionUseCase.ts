import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import { WorkflowToolProjectionService } from "../projection/WorkflowToolProjectionService";
import type { ToolDefinition } from "../projection/models/ToolDefinition";

export class LoadToolDefinitionUseCase {
  constructor(
    private readonly workflowRepository: IWorkflowRepository,
    private readonly workflowToolProjectionService: WorkflowToolProjectionService
  ) {}

  public async execute(toolIdentifier: string): Promise<ToolDefinition> {
    const summaries = await this.workflowRepository.list();

    for (const summary of summaries) {
      let workflow;
      try {
        workflow = await this.workflowRepository.load(summary.id);
      } catch {
        continue;
      }
      if (!workflow) {
        continue;
      }
      const definition = this.workflowToolProjectionService.projectToTool(workflow);
      if (definition.id === toolIdentifier || definition.slug === toolIdentifier) {
        return definition;
      }
    }

    throw new Error(`Tool '${toolIdentifier}' was not found.`);
  }
}
