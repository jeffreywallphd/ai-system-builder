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
    workflowValidator: IWorkflowValidator
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
