import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import { WorkflowToolProjectionService } from "../projection/WorkflowToolProjectionService";
import type { ToolDefinition } from "../projection/models/ToolDefinition";
import type { ToolSearchCriteria } from "../dto/ToolSearchCriteria";
import { ToolAutomationTypeClassifier } from "../../domain/services/ToolAutomationTypeClassifier";

export interface ListPublishedToolsResult {
  readonly tools: ReadonlyArray<
    Pick<ToolDefinition, "id" | "slug" | "title" | "description" | "category"> & {
      readonly typeId: string;
      readonly typeLabel: string;
    }
  >;
  readonly availableTypes: ReadonlyArray<{ readonly id: string; readonly label: string }>;
}

export class ListPublishedToolsUseCase {
  constructor(
    private readonly workflowRepository: IWorkflowRepository,
    private readonly workflowToolProjectionService: WorkflowToolProjectionService,
    private readonly toolAutomationTypeClassifier: ToolAutomationTypeClassifier =
      new ToolAutomationTypeClassifier()
  ) {}

  public async execute(criteria?: ToolSearchCriteria): Promise<ListPublishedToolsResult> {
    const summaries = await this.workflowRepository.list();
    const tools: ListPublishedToolsResult["tools"] = [];
    const normalizedQuery = criteria?.query?.trim().toLowerCase();
    const selectedTypeIds = new Set(criteria?.typeIds?.map((typeId) => typeId.trim()) ?? []);

    for (const summary of summaries) {
      if (!summary.metadata.isPublishedAsTool) {
        continue;
      }
      const workflow = await this.workflowRepository.load(summary.id);
      if (!workflow) {
        continue;
      }
      const def = this.workflowToolProjectionService.projectToTool(workflow);
      const type = this.toolAutomationTypeClassifier.classify({
        title: def.title,
        description: def.description,
        category: def.category,
      });
      const searchable = `${def.title} ${def.description ?? ""} ${def.category ?? ""}`.toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) {
        continue;
      }

      if (selectedTypeIds.size > 0 && !selectedTypeIds.has(type.id)) {
        continue;
      }

      tools.push({
        id: def.id,
        slug: def.slug,
        title: def.title,
        description: def.description,
        category: def.category,
        typeId: type.id,
        typeLabel: type.label,
      });
    }

    return {
      tools,
      availableTypes: this.toolAutomationTypeClassifier
        .listSupportedTypes()
        .map((type) => ({ id: type.id, label: type.label })),
    };
  }
}
