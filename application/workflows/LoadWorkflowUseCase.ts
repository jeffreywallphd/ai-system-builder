import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";

export interface ILoadWorkflowRequest {
  readonly workflowId: string;

  /**
   * Whether to validate the workflow after loading.
   */
  readonly validateOnLoad?: boolean;

  /**
   * When true, invalid workflows may still be returned and validation will be included.
   */
  readonly allowInvalidLoad?: boolean;

  /**
   * Whether a missing workflow should throw.
   */
  readonly throwIfNotFound?: boolean;

  /**
   * Optional validation options for post-load validation.
   */
  readonly validationOptions?: IWorkflowValidationOptions;
}

export interface ILoadWorkflowResult {
  readonly workflow?: IWorkflow;
  readonly validation?: IWorkflowValidationResult;
}

export class LoadWorkflowUseCase {
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
    request: ILoadWorkflowRequest
  ): Promise<ILoadWorkflowResult> {
    const workflowId = request.workflowId.trim();

    if (!workflowId) {
      throw new Error("LoadWorkflowUseCase requires a non-empty workflowId.");
    }

    const workflow = await this.workflowRepository.load(workflowId);

    if (!workflow) {
      if (request.throwIfNotFound ?? true) {
        throw new Error(`Workflow '${workflowId}' was not found.`);
      }

      return Object.freeze({
        workflow: undefined,
        validation: undefined,
      });
    }

    let validation: IWorkflowValidationResult | undefined;

    if (request.validateOnLoad ?? true) {
      validation = this.workflowValidator
        ? this.workflowValidator.validateWorkflow(
            workflow,
            request.validationOptions
          )
        : workflow.validate();

      if (!(request.allowInvalidLoad ?? true) && !validation.isValid) {
        throw new Error(
          `Loaded workflow '${workflow.id}' failed validation: ${validation.messages.join(
            " | "
          )}`
        );
      }
    }

    return Object.freeze({
      workflow,
      validation,
    });
  }
}
