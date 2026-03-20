import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
} from "../ports/interfaces/IWorkflowExecutor";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { WorkflowContextService } from "../context/WorkflowContextService";

export interface IExecuteWorkflowRequest {
  readonly workflow: IWorkflow;
  readonly target?: IWorkflowExecutionInput["target"];
  readonly propertyOverrides?: IWorkflowExecutionInput["propertyOverrides"];
  readonly inputAssets?: IWorkflowExecutionInput["inputAssets"];
  readonly parameters?: IWorkflowExecutionInput["parameters"];
  readonly validateBeforeExecute?: boolean;
  readonly validationOptions?: IWorkflowValidationOptions;
}

export interface IExecuteWorkflowResult {
  readonly effectiveWorkflow: IWorkflow;
  readonly result: IWorkflowExecutionResult;
}

export class ExecuteWorkflowUseCase {
  private readonly workflowExecutor: IWorkflowExecutor;
  private readonly workflowValidator: IWorkflowValidator;

  constructor(
    workflowExecutor: IWorkflowExecutor,
    workflowValidator: IWorkflowValidator,
    private readonly workflowContextService?: WorkflowContextService
  ) {
    this.workflowExecutor = workflowExecutor;
    this.workflowValidator = workflowValidator;
  }

  public async execute(
    request: IExecuteWorkflowRequest,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IExecuteWorkflowResult> {
    const effectiveWorkflow = this.applyPropertyOverrides(
      request.workflow,
      request.propertyOverrides
    );
    const executionMetadata = await this.resolveExecutionMetadata(effectiveWorkflow, request.parameters);

    if (request.validateBeforeExecute ?? true) {
      this.ensureWorkflowValid(
        effectiveWorkflow,
        request.validationOptions ?? {
          runtime:
            typeof request.target?.runtime === "string"
              ? request.target.runtime
              : undefined,
          validateDependencies: true,
          validateModelCompatibility: true,
        }
      );
    }

    const result = await this.workflowExecutor.execute(
      {
        workflow: effectiveWorkflow,
        target: request.target,
        propertyOverrides: request.propertyOverrides,
        inputAssets: request.inputAssets,
        parameters: request.parameters,
        executionMetadata,
      },
      onEvent
    );

    return Object.freeze({
      effectiveWorkflow,
      result,
    });
  }

  public async startExecution(
    request: IExecuteWorkflowRequest
  ): Promise<{
    effectiveWorkflow: IWorkflow;
    handle: IWorkflowExecutionHandle;
  }> {
    const effectiveWorkflow = this.applyPropertyOverrides(
      request.workflow,
      request.propertyOverrides
    );
    const executionMetadata = await this.resolveExecutionMetadata(effectiveWorkflow, request.parameters);

    if (request.validateBeforeExecute ?? true) {
      this.ensureWorkflowValid(
        effectiveWorkflow,
        request.validationOptions ?? {
          runtime:
            typeof request.target?.runtime === "string"
              ? request.target.runtime
              : undefined,
          validateDependencies: true,
          validateModelCompatibility: true,
        }
      );
    }

    const handle = await this.workflowExecutor.startExecution({
      workflow: effectiveWorkflow,
      target: request.target,
      propertyOverrides: request.propertyOverrides,
      inputAssets: request.inputAssets,
      parameters: request.parameters,
      executionMetadata,
    });

    return Object.freeze({
      effectiveWorkflow,
      handle,
    });
  }

  private applyPropertyOverrides(
    workflow: IWorkflow,
    overrides?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  ): IWorkflow {
    if (!overrides || Object.keys(overrides).length === 0) {
      return workflow;
    }

    let effectiveWorkflow = workflow;

    for (const [nodeId, propertyMap] of Object.entries(overrides)) {
      const node = effectiveWorkflow.getNode(nodeId);

      if (!node) {
        throw new Error(`Property overrides reference unknown node '${nodeId}'.`);
      }

      let updatedNode = node;

      for (const [propertyId, value] of Object.entries(propertyMap)) {
        if (!updatedNode.getProperty(propertyId)) {
          throw new Error(
            `Property overrides reference unknown property '${propertyId}' on node '${nodeId}'.`
          );
        }

        updatedNode = updatedNode.withPropertyValue(propertyId, value);
      }

      effectiveWorkflow = effectiveWorkflow.updateNode(updatedNode);
    }

    return effectiveWorkflow;
  }

  private async resolveExecutionMetadata(
    workflow: IWorkflow,
    parameters?: Readonly<Record<string, unknown>>
  ): Promise<Readonly<Record<string, unknown>> | undefined> {
    if (
      !this.workflowContextService ||
      (!(workflow.metadata.contextConfiguration?.packageReferences?.length) &&
        !(workflow.metadata.contextConfiguration?.recipeSelections?.length))
    ) {
      return undefined;
    }

    const contextSelection =
      parameters?.workflowContext && typeof parameters.workflowContext === "object"
        ? (parameters.workflowContext as Record<string, unknown>)
        : undefined;

    const result = await this.workflowContextService.inspectWorkflowContext({
      workflow,
      selectedRecipeIds: Array.isArray(contextSelection?.selectedRecipeIds)
        ? contextSelection.selectedRecipeIds.filter((value): value is string => typeof value === "string")
        : undefined,
      selectedPackageIds: Array.isArray(contextSelection?.selectedPackageIds)
        ? contextSelection.selectedPackageIds.filter((value): value is string => typeof value === "string")
        : undefined,
      visibilityMode:
        contextSelection?.visibilityMode === "basic" || contextSelection?.visibilityMode === "advanced"
          ? contextSelection.visibilityMode
          : undefined,
      maxCharacters:
        typeof contextSelection?.maxCharacters === "number" ? contextSelection.maxCharacters : undefined,
      maxTokens: typeof contextSelection?.maxTokens === "number" ? contextSelection.maxTokens : undefined,
      trimPartialFragments:
        typeof contextSelection?.trimPartialFragments === "boolean"
          ? contextSelection.trimPartialFragments
          : undefined,
      dynamicSources: Array.isArray(contextSelection?.dynamicSources)
        ? (contextSelection.dynamicSources as ReadonlyArray<Record<string, unknown>>)
        : undefined,
    });

    return Object.freeze({
      workflowContext: result.executionContext,
    });
  }

  private ensureWorkflowValid(
    workflow: IWorkflow,
    options?: IWorkflowValidationOptions
  ): void {
    const validation = this.workflowValidator.validateWorkflow(workflow, options);

    if (!validation.isValid) {
      throw new Error(
        `Workflow execution failed validation: ${validation.messages
          .map((message) => message.message)
          .join(" | ")}`
      );
    }
  }
}
