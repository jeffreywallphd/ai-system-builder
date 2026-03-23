import type { WorkflowContextService } from "../context/WorkflowContextService";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { IWorkflowExecutionResult, IWorkflowExecutor } from "../ports/interfaces/IWorkflowExecutor";
import { WorkflowToolProjectionService } from "../projection/WorkflowToolProjectionService";
import type { ToolRunRequest } from "../projection/models/ToolRunRequest";
import type { ToolRunResult } from "../projection/models/ToolRunResult";
import { LoadToolDefinitionUseCase } from "./LoadToolDefinitionUseCase";
import type { UnifiedExecutionEngine } from "../execution/UnifiedExecutionEngine";
import { createWorkflowExecutionPlan, requireWorkflowExecutionResult } from "../execution/WorkflowExecutionPlanFactory";

export class RunToolUseCase {
  constructor(
    private readonly workflowRepository: IWorkflowRepository,
    private readonly workflowToolProjectionService: WorkflowToolProjectionService,
    private readonly workflowExecutor: IWorkflowExecutor,
    private readonly loadToolDefinitionUseCase: LoadToolDefinitionUseCase,
    private readonly workflowContextService?: WorkflowContextService,
    private readonly executionEngine?: UnifiedExecutionEngine,
  ) {}

  public async execute(request: ToolRunRequest): Promise<ToolRunResult> {
    const definition = await this.loadToolDefinitionUseCase.execute(request.toolId);
    const workflow = await this.workflowRepository.load(definition.workflowId);

    if (!workflow) {
      throw new Error(`Workflow '${definition.workflowId}' for tool '${request.toolId}' was not found.`);
    }

    const effectiveWorkflow = this.workflowToolProjectionService.applyToolInput(workflow, request.values);
    const executionMetadata = await this.resolveExecutionMetadata(effectiveWorkflow);
    const result = await this.executeWorkflowInput({
      workflow: effectiveWorkflow,
      parameters: Object.freeze({ ...request.values }),
      executionMetadata,
    });

    return {
      toolId: definition.id,
      executionId: result.executionId,
      status: result.status,
      messages: Object.freeze([...(result.messages ?? []), ...(result.errorMessage ? [result.errorMessage] : [])]),
      provenance: result.provenance,
    };
  }

  private async executeWorkflowInput(
    input: {
      readonly workflow: IWorkflow;
      readonly parameters: Readonly<Record<string, unknown>>;
      readonly executionMetadata?: Readonly<Record<string, unknown>>;
    }
  ): Promise<IWorkflowExecutionResult> {
    if (!this.executionEngine) {
      return this.workflowExecutor.execute(input);
    }

    const executionPlan = createWorkflowExecutionPlan(input);
    const planResult = await this.executionEngine.execute({
      plan: executionPlan.plan,
      unitInputs: executionPlan.unitInputs,
      metadata: executionPlan.metadata,
    });

    return requireWorkflowExecutionResult(planResult, executionPlan.unitId);
  }

  private async resolveExecutionMetadata(
    workflow: IWorkflow
  ): Promise<Readonly<Record<string, unknown>> | undefined> {
    if (
      !this.workflowContextService ||
      (!(workflow.metadata.contextConfiguration?.packageReferences?.length) &&
        !(workflow.metadata.contextConfiguration?.recipeSelections?.length))
    ) {
      return undefined;
    }

    const result = await this.workflowContextService.inspectWorkflowContext({
      workflow,
      selectedRecipeIds: workflow.metadata.contextConfiguration.selectedRecipeIds,
      selectedPackageIds: workflow.metadata.contextConfiguration.selectedPackageIds,
      visibilityMode: workflow.metadata.contextConfiguration.visibilityMode,
    });

    return Object.freeze({
      workflowContext: result.executionContext,
    });
  }
}
