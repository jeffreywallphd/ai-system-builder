import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "@domain/services/interfaces/IWorkflowValidator";

export interface IValidateWorkflowRequest {
  readonly workflow: IWorkflow;
  readonly options?: IWorkflowValidationOptions;
}

export interface IValidateWorkflowResult {
  readonly workflow: IWorkflow;
  readonly validation: IWorkflowValidationResult;
}

export class ValidateWorkflowUseCase {
  private readonly workflowValidator: IWorkflowValidator;

  constructor(workflowValidator: IWorkflowValidator) {
    this.workflowValidator = workflowValidator;
  }

  public execute(
    request: IValidateWorkflowRequest
  ): IValidateWorkflowResult {
    const validation = this.workflowValidator.validateWorkflow(
      request.workflow,
      request.options
    );

    return Object.freeze({
      workflow: request.workflow,
      validation,
    });
  }
}

