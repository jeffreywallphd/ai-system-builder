import type { INode } from "../../domain/nodes/interfaces/INode";
import type { INodeProperty } from "../../domain/nodes/interfaces/INodeProperty";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "../../domain/services/interfaces/IWorkflowValidator";

export interface IUpdateNodePropertyRequest {
  readonly workflow: IWorkflow;
  readonly nodeId: string;
  readonly propertyId: string;
  readonly value: unknown;

  /**
   * When true, invalid intermediate node/workflow states are allowed and returned
   * to the caller instead of throwing.
   */
  readonly allowInvalidIntermediateState?: boolean;

  /**
   * Whether to validate the updated node.
   */
  readonly validateNode?: boolean;

  /**
   * Whether to validate the whole workflow after the update.
   */
  readonly validateWorkflow?: boolean;

  /**
   * Optional workflow validation options.
   */
  readonly validationOptions?: IWorkflowValidationOptions;
}

export interface IUpdateNodePropertyResult {
  readonly workflow: IWorkflow;
  readonly node: INode;
  readonly property: INodeProperty;
  readonly nodeValidation?: IWorkflowValidationResult;
  readonly workflowValidation?: IWorkflowValidationResult;
}

export class UpdateNodePropertyUseCase {
  private readonly workflowValidator?: IWorkflowValidator;

  constructor(workflowValidator?: IWorkflowValidator) {
    this.workflowValidator = workflowValidator;
  }

  public execute(
    request: IUpdateNodePropertyRequest
  ): IUpdateNodePropertyResult {
    const nodeId = request.nodeId.trim();
    const propertyId = request.propertyId.trim();

    if (!nodeId) {
      throw new Error("UpdateNodePropertyUseCase requires a non-empty nodeId.");
    }

    if (!propertyId) {
      throw new Error("UpdateNodePropertyUseCase requires a non-empty propertyId.");
    }

    const node = request.workflow.getNode(nodeId);

    if (!node) {
      throw new Error(`Workflow does not contain node '${nodeId}'.`);
    }

    const property = node.getProperty(propertyId);

    if (!property) {
      throw new Error(
        `Node '${nodeId}' does not contain property '${propertyId}'.`
      );
    }

    if (!property.isEditable) {
      throw new Error(
        `Property '${propertyId}' on node '${nodeId}' is not editable.`
      );
    }

    const updatedNode = node.withPropertyValue(propertyId, request.value);
    const updatedProperty = updatedNode.getProperty(propertyId);

    if (!updatedProperty) {
      throw new Error(
        `Updated node '${nodeId}' no longer contains property '${propertyId}'.`
      );
    }

    const updatedWorkflow = request.workflow.updateNode(updatedNode);

    const allowInvalid = request.allowInvalidIntermediateState ?? true;
    const shouldValidateNode = request.validateNode ?? true;
    const shouldValidateWorkflow = request.validateWorkflow ?? false;

    let nodeValidation: IWorkflowValidationResult | undefined;
    let workflowValidation: IWorkflowValidationResult | undefined;

    if (shouldValidateNode) {
      nodeValidation = this.validateNode(
        updatedNode,
        updatedWorkflow,
        request.validationOptions
      );

      if (!allowInvalid && nodeValidation && !nodeValidation.isValid) {
        throw new Error(
          `Updated node '${updatedNode.id}' is invalid: ${nodeValidation.messages.join(
            " | "
          )}`
        );
      }
    }

    if (shouldValidateWorkflow) {
      workflowValidation = this.validateWorkflow(
        updatedWorkflow,
        request.validationOptions
      );

      if (!allowInvalid && workflowValidation && !workflowValidation.isValid) {
        throw new Error(
          `Updated workflow '${updatedWorkflow.id}' is invalid: ${workflowValidation.messages.join(
            " | "
          )}`
        );
      }
    }

    return Object.freeze({
      workflow: updatedWorkflow,
      node: updatedNode,
      property: updatedProperty,
      nodeValidation,
      workflowValidation,
    });
  }

  private validateNode(
    node: INode,
    workflow: IWorkflow,
    options?: IWorkflowValidationOptions
  ): IWorkflowValidationResult {
    if (this.workflowValidator) {
      return this.workflowValidator.validateNode(node, {
        workflow,
        graph: workflow.toGraph(),
        options,
      });
    }

    const result = node.validate();

    return {
      isValid: result.isValid,
      messages: Object.freeze([...result.messages]),
      errors: Object.freeze([]),
      warnings: Object.freeze([]),
      info: Object.freeze([]),
      invalidNodeIds: result.isValid ? Object.freeze([]) : Object.freeze([node.id]),
      invalidConnectionIds: Object.freeze([]),
      hasErrors(): boolean {
        return !result.isValid;
      },
      hasWarnings(): boolean {
        return false;
      },
      hasMessage(): boolean {
        return false;
      },
    };
  }

  private validateWorkflow(
    workflow: IWorkflow,
    options?: IWorkflowValidationOptions
  ): IWorkflowValidationResult {
    if (this.workflowValidator) {
      return this.workflowValidator.validateWorkflow(workflow, options);
    }

    return workflow.validate();
  }
}
