import type { INode } from "../../domain/nodes/interfaces/INode";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";

export interface IRemoveNodeRequest {
  readonly workflow: IWorkflow;
  readonly nodeId: string;
  readonly validateWorkflow?: boolean;
  readonly validationOptions?: IWorkflowValidationOptions;
}

export interface IRemoveNodeResult {
  readonly workflow: IWorkflow;
  readonly removedNode: INode;
  readonly removedConnectionIds: ReadonlyArray<string>;
  readonly workflowValidation?: IWorkflowValidationResult;
}

export class RemoveNodeUseCase {
  private readonly workflowValidator?: IWorkflowValidator;

  constructor(workflowValidator?: IWorkflowValidator) {
    this.workflowValidator = workflowValidator;
  }

  public execute(request: IRemoveNodeRequest): IRemoveNodeResult {
    const nodeId = request.nodeId.trim();

    if (!nodeId) {
      throw new Error("RemoveNodeUseCase requires a non-empty nodeId.");
    }

    const node = request.workflow.getNode(nodeId);

    if (!node) {
      throw new Error(`Workflow does not contain node '${nodeId}'.`);
    }

    const removedConnectionIds = request.workflow.connections
      .filter((connection) => connection.involvesNode(nodeId))
      .map((connection) => connection.id);

    const workflow = request.workflow.removeNode(nodeId);

    let workflowValidation: IWorkflowValidationResult | undefined;

    if (request.validateWorkflow) {
      workflowValidation = this.workflowValidator
        ? this.workflowValidator.validateWorkflow(
            workflow,
            request.validationOptions
          )
        : workflow.validate();
    }

    return Object.freeze({
      workflow,
      removedNode: node,
      removedConnectionIds: Object.freeze([...removedConnectionIds]),
      workflowValidation,
    });
  }
}
