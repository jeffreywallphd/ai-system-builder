import { WorkflowMetadata } from "../../domain/workflows/WorkflowMetadata";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import { LoadToolDefinitionUseCase } from "../tools/LoadToolDefinitionUseCase";
import { WorkflowContextService, type IResolveWorkflowContextRequest } from "./WorkflowContextService";
import { createBasePreviewResult, createDeliveryTargets } from "./ContextPreviewSupport";
import type { ContextPreviewResult } from "./models/ContextPreview";

export interface IPreviewToolContextRequest extends Omit<IResolveWorkflowContextRequest, "workflow"> {
  readonly toolId: string;
}

function restrictWorkflowToToolSurface(workflow: IWorkflow): IWorkflow {
  const contextConfiguration = workflow.metadata.contextConfiguration;
  if (!contextConfiguration) {
    return workflow;
  }

  const recipeSelections = (contextConfiguration.recipeSelections ?? []).filter(
    (selection) => selection.surfaceInTool !== false && selection.isEnabled !== false
  );
  const selectedRecipeIds = (contextConfiguration.selectedRecipeIds ?? []).filter((recipeId) =>
    recipeSelections.some((selection) => selection.recipeId === recipeId)
  );

  return workflow.withMetadata(
    new WorkflowMetadata({
      ...workflow.metadata,
      contextConfiguration: {
        ...contextConfiguration,
        recipeSelections,
        selectedRecipeIds,
      },
    })
  );
}

export class PreviewToolContextUseCase {
  public constructor(
    private readonly workflowRepository: IWorkflowRepository,
    private readonly loadToolDefinitionUseCase: LoadToolDefinitionUseCase,
    private readonly workflowContextService: WorkflowContextService,
  ) {}

  public async execute(request: IPreviewToolContextRequest): Promise<ContextPreviewResult> {
    const tool = await this.loadToolDefinitionUseCase.execute(request.toolId);
    const workflow = await this.workflowRepository.load(tool.workflowId);

    if (!workflow) {
      throw new Error(`Workflow '${tool.workflowId}' for tool '${request.toolId}' was not found.`);
    }

    const toolWorkflow = restrictWorkflowToToolSurface(workflow);
    const resolved = await this.workflowContextService.inspectWorkflowContext({
      ...request,
      workflow: toolWorkflow,
    });

    return createBasePreviewResult({
      target: {
        kind: "tool",
        id: tool.id,
        label: tool.title,
        workflowId: workflow.id,
        workflowLabel: workflow.metadata.name,
      },
      resolved,
      deliveryTargets: createDeliveryTargets({
        kind: "tool",
        finalPromptText: resolved.inspection.finalPromptText,
        assembledPromptText: resolved.inspection.assembledPromptText,
        toolUsePolicy: resolved.executionContext.toolUsePolicy,
      }),
    });
  }
}
