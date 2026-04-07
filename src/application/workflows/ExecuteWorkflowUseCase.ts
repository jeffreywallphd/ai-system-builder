import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
} from "../ports/interfaces/IWorkflowExecutor";
import { WorkflowExecutionHandle, WorkflowExecutionProgress, WorkflowExecutionResult } from "../ports/WorkflowExecutor";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { WorkflowContextService } from "../context/WorkflowContextService";
import type { DynamicContextSourceInput } from "../context/models/ContextAssemblyRequest";
import type { UnifiedExecutionEngine } from "../execution/UnifiedExecutionEngine";
import {
  createWorkflowExecutionPlan,
  getWorkflowExecutionEventFromEngineEvent,
  requireWorkflowExecutionResult,
} from "../execution/WorkflowExecutionPlanFactory";


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
  private readonly executionEngine?: UnifiedExecutionEngine;

  constructor(
    workflowExecutor: IWorkflowExecutor,
    workflowValidator: IWorkflowValidator,
    private readonly workflowContextService?: WorkflowContextService,
    executionEngine?: UnifiedExecutionEngine,
  ) {
    this.workflowExecutor = workflowExecutor;
    this.workflowValidator = workflowValidator;
    this.executionEngine = executionEngine;
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

    const executionInput: IWorkflowExecutionInput = {
      workflow: effectiveWorkflow,
      target: request.target,
      propertyOverrides: request.propertyOverrides,
      inputAssets: request.inputAssets,
      parameters: request.parameters,
      executionMetadata,
    };

    const result = this.executionEngine
      ? await this.executeThroughPlan(executionInput, onEvent)
      : await this.workflowExecutor.execute(executionInput, onEvent);

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

    const executionInput: IWorkflowExecutionInput = {
      workflow: effectiveWorkflow,
      target: request.target,
      propertyOverrides: request.propertyOverrides,
      inputAssets: request.inputAssets,
      parameters: request.parameters,
      executionMetadata,
    };

    const handle = this.executionEngine
      ? await this.startThroughPlan(executionInput)
      : await this.workflowExecutor.startExecution(executionInput);

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

  private async executeThroughPlan(
    executionInput: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    if (!this.executionEngine) {
      return this.workflowExecutor.execute(executionInput, onEvent);
    }

    const executionPlan = createWorkflowExecutionPlan(executionInput);
    const planResult = await this.executionEngine.execute(
      {
        plan: executionPlan.plan,
        unitInputs: executionPlan.unitInputs,
        metadata: executionPlan.metadata,
      },
      (event) => {
        const workflowEvent = getWorkflowExecutionEventFromEngineEvent(event);
        if (workflowEvent) {
          onEvent?.(workflowEvent);
        }
      }
    );
    return requireWorkflowExecutionResult(planResult, executionPlan.unitId);
  }


  private async startThroughPlan(
    executionInput: IWorkflowExecutionInput,
  ): Promise<IWorkflowExecutionHandle> {
    if (!this.executionEngine) {
      return this.workflowExecutor.startExecution(executionInput);
    }

    const executionPlan = createWorkflowExecutionPlan(executionInput);
    const runHandle = await this.executionEngine.startExecution({
      plan: executionPlan.plan,
      unitInputs: executionPlan.unitInputs,
      metadata: executionPlan.metadata,
    });

    return new WorkflowExecutionHandle({
      executionId: runHandle.runId,
      input: executionInput,
      initialProgress: new WorkflowExecutionProgress({
        executionId: runHandle.runId,
        status: "queued",
        percent: 0,
        message: `Queued execution plan '${executionPlan.plan.id}'.`,
      }),
      completionPromise: runHandle.waitForCompletion().then((planResult) =>
        WorkflowExecutionResult.from(requireWorkflowExecutionResult(planResult, executionPlan.unitId))
      ),
      cancel: async () => {
        await runHandle.cancel();
      },
      subscribe: typeof runHandle.subscribe === "function"
        ? async (listener) => {
            const unsubscribe = await runHandle.subscribe?.((event) => {
              const workflowEvent = getWorkflowExecutionEventFromEngineEvent(event);
              if (!workflowEvent) {
                return;
              }

              listener(workflowEvent);
            });
            return typeof unsubscribe === "function" ? unsubscribe : () => undefined;
          }
        : undefined,
    });
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
        ? (contextSelection.dynamicSources as ReadonlyArray<DynamicContextSourceInput>)
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
