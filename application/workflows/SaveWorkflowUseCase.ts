import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";

export interface ISaveWorkflowRequest {
  readonly workflow: IWorkflow;

  /**
   * Whether workflow validation should occur before saving.
   */
  readonly validateBeforeSave?: boolean;

  /**
   * When true, invalid workflows may still be saved and validation will be returned.
   */
  readonly allowInvalidSave?: boolean;

  /**
   * Optional validation options for pre-save validation.
   */
  readonly validationOptions?: IWorkflowValidationOptions;
}

export interface ISaveWorkflowResult {
  readonly workflow: IWorkflow;
  readonly validation?: IWorkflowValidationResult;
}

export class SaveWorkflowUseCase {
  private readonly workflowRepository: IWorkflowRepository;
  private readonly workflowValidator?: IWorkflowValidator;

  constructor(
    workflowRepository: IWorkflowRepository,
    workflowValidator?: IWorkflowValidator
  ) {
    this.workflowRepository = workflowRepository;
    this.workflowValidator = workflowValidator;
  }

  public async execute(
    request: ISaveWorkflowRequest
  ): Promise<ISaveWorkflowResult> {
    let validation: IWorkflowValidationResult | undefined;

    if (request.validateBeforeSave ?? true) {
      validation = this.workflowValidator
        ? this.workflowValidator.validateWorkflow(
            request.workflow,
            request.validationOptions
          )
        : request.workflow.validate();

      if (!(request.allowInvalidSave ?? false) && !validation.isValid) {
        throw new Error(
          `Workflow '${request.workflow.id}' failed validation and cannot be saved: ${validation.messages.join(
            " | "
          )}`
        );
      }
    }

    const workflow = await this.workflowRepository.save(request.workflow);

    return Object.freeze({
      workflow,
      validation,
    });
  }
}
