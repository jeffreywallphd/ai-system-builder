import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import { WorkflowToolProjectionService } from "../projection/WorkflowToolProjectionService";
import type { ToolDefinition } from "../projection/models/ToolDefinition";

export interface ListPublishedToolsResult {
  readonly tools: ReadonlyArray<Pick<ToolDefinition, "id" | "slug" | "title" | "description" | "category">>;
}

export class ListPublishedToolsUseCase {
  constructor(
    private readonly workflowRepository: IWorkflowRepository,
    private readonly workflowToolProjectionService: WorkflowToolProjectionService
  ) {}

  public async execute(): Promise<ListPublishedToolsResult> {
    const summaries = await this.workflowRepository.list();
    const tools: ListPublishedToolsResult["tools"] = [];

    for (const summary of summaries) {
      if (!summary.metadata.isPublishedAsTool) {
        continue;
      }
      const workflow = await this.workflowRepository.load(summary.id);
      if (!workflow) {
        continue;
      }
      const def = this.workflowToolProjectionService.projectToTool(workflow);
      tools.push({ id: def.id, slug: def.slug, title: def.title, description: def.description, category: def.category });
    }

    return { tools };
  }
}
