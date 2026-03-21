import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { IWorkflowRepository } from "../../application/ports/interfaces/IWorkflowRepository";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionResult,
} from "../../application/ports/interfaces/IWorkflowExecutor";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
} from "../../domain/services/interfaces/IWorkflowValidator";
import {
  CreateWorkflowUseCase,
  type ICreateWorkflowRequest,
  type ICreateWorkflowResult,
} from "../../application/workflows/CreateWorkflowUseCase";
import {
  ExecuteWorkflowUseCase,
  type IExecuteWorkflowRequest,
  type IExecuteWorkflowResult,
} from "../../application/workflows/ExecuteWorkflowUseCase";
import {
  ValidateWorkflowUseCase,
  type IValidateWorkflowRequest,
  type IValidateWorkflowResult,
} from "../../application/workflows/ValidateWorkflowUseCase";

export interface IWorkflowServiceOptions {
  readonly createWorkflowUseCase: CreateWorkflowUseCase;
  readonly executeWorkflowUseCase: ExecuteWorkflowUseCase;
  readonly validateWorkflowUseCase: ValidateWorkflowUseCase;
  readonly workflowRepository: IWorkflowRepository;
}

export class WorkflowService {
  private readonly createWorkflowUseCase: CreateWorkflowUseCase;
  private readonly executeWorkflowUseCase: ExecuteWorkflowUseCase;
  private readonly validateWorkflowUseCase: ValidateWorkflowUseCase;
  private readonly workflowRepository: IWorkflowRepository;

  constructor(options: IWorkflowServiceOptions) {
    this.createWorkflowUseCase = options.createWorkflowUseCase;
    this.executeWorkflowUseCase = options.executeWorkflowUseCase;
    this.validateWorkflowUseCase = options.validateWorkflowUseCase;
    this.workflowRepository = options.workflowRepository;
  }

  public async createWorkflow(
    request: ICreateWorkflowRequest
  ): Promise<ICreateWorkflowResult> {
    const result = this.createWorkflowUseCase.execute(request);
    return result;
  }

  public async loadWorkflow(id: string): Promise<IWorkflow | undefined> {
    const workflowId = id.trim();

    if (!workflowId) {
      throw new Error("WorkflowService.loadWorkflow requires a non-empty id.");
    }

    return this.workflowRepository.load(workflowId);
  }

  public async listWorkflows(): Promise<ReadonlyArray<IWorkflow>> {
    const summaries = await this.workflowRepository.list();
    const workflows = await Promise.all(
      summaries.map(async (summary) => this.workflowRepository.load(summary.id))
    );

    return Object.freeze(
      workflows.filter((workflow): workflow is IWorkflow => !!workflow)
    );
  }

  public async saveWorkflow(workflow: IWorkflow): Promise<IWorkflow> {
    return this.workflowRepository.save(workflow);
  }

  public async deleteWorkflow(id: string): Promise<boolean> {
    const workflowId = id.trim();

    if (!workflowId) {
      throw new Error("WorkflowService.deleteWorkflow requires a non-empty id.");
    }

    const existed = await this.workflowRepository.exists(workflowId);
    await this.workflowRepository.delete(workflowId);
    return existed;
  }

  public validateWorkflow(
    workflow: IWorkflow,
    options?: IWorkflowValidationOptions
  ): IWorkflowValidationResult {
    const request: IValidateWorkflowRequest = {
      workflow,
      options,
    };

    const result: IValidateWorkflowResult =
      this.validateWorkflowUseCase.execute(request);

    return result.validation;
  }

  public async executeWorkflow(
    request: IExecuteWorkflowRequest,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IExecuteWorkflowResult> {
    return this.executeWorkflowUseCase.execute(request, onEvent);
  }

  public updateNodeProperty(
    workflow: IWorkflow,
    nodeId: string,
    propertyId: string,
    value: unknown
  ): IWorkflow {
    const normalizedNodeId = nodeId.trim();
    const normalizedPropertyId = propertyId.trim();

    if (!normalizedNodeId) {
      throw new Error("WorkflowService.updateNodeProperty requires a nodeId.");
    }

    if (!normalizedPropertyId) {
      throw new Error("WorkflowService.updateNodeProperty requires a propertyId.");
    }

    const node = workflow.getNode(normalizedNodeId);

    if (!node) {
      throw new Error(`Node '${normalizedNodeId}' was not found.`);
    }

    if (!node.getProperty(normalizedPropertyId)) {
      throw new Error(
        `Property '${normalizedPropertyId}' was not found on node '${normalizedNodeId}'.`
      );
    }

    const updatedNode = node.withPropertyValue(normalizedPropertyId, value);
    return workflow.updateNode(updatedNode);
  }

  public renameWorkflow(workflow: IWorkflow, name: string): IWorkflow {
    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new Error("WorkflowService.renameWorkflow requires a non-empty name.");
    }

    return workflow.withMetadata({
      ...workflow.metadata,
      name: normalizedName,
    });
  }

  public setWorkflowDescription(
    workflow: IWorkflow,
    description: string | undefined
  ): IWorkflow {
    return workflow.withMetadata({
      ...workflow.metadata,
      description: description?.trim() || undefined,
    });
  }

  public markWorkflowEnabled(workflow: IWorkflow, isEnabled: boolean): IWorkflow {
    return workflow.withEnabled(isEnabled);
  }

  public cloneWorkflow(
    workflow: IWorkflow,
    params: {
      readonly newId: string;
      readonly newName?: string;
    }
  ): IWorkflow {
    const newId = params.newId.trim();

    if (!newId) {
      throw new Error("WorkflowService.cloneWorkflow requires a newId.");
    }

    return {
      ...workflow,
      id: newId,
      metadata: {
        ...workflow.metadata,
        name: params.newName?.trim() || `${workflow.metadata.name} Copy`,
      },
    } as IWorkflow;
  }

  public extractExecutionMessages(
    result: IWorkflowExecutionResult
  ): ReadonlyArray<string> {
    return Object.freeze([
      ...(result.messages ?? []),
      ...(result.errorMessage ? [result.errorMessage] : []),
    ]);
  }
}
