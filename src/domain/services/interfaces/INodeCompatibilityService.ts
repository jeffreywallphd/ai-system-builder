import type { INode } from "@domain/nodes/interfaces/INode";
import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";
import type { INodePort } from "@domain/nodes/interfaces/INodePort";
import type { INodeProperty } from "@domain/nodes/interfaces/INodeProperty";
import type { IWorkflowConnection } from "../../workflows/interfaces/IWorkflowConnection";
import type { IWorkflow } from "../../workflows/interfaces/IWorkflow";
import type { IWorkflowGraph } from "../../workflows/interfaces/IWorkflowGraph";
import type { IModel } from "../../models/interfaces/IModel";
import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "../../models/interfaces/IModelCompatibility";

export type NodeCompatibilitySeverity = "compatible" | "warning" | "incompatible";

export type NodeCompatibilityReasonCode =
  | "port-direction-mismatch"
  | "port-value-type-mismatch"
  | "port-modality-mismatch"
  | "port-task-mismatch"
  | "port-runtime-mismatch"
  | "port-model-compatibility-mismatch"
  | "port-dependency-mismatch"
  | "property-model-compatibility-mismatch"
  | "property-runtime-mismatch"
  | "node-runtime-mismatch"
  | "node-task-mismatch"
  | "node-model-compatibility-mismatch"
  | "connection-invalid"
  | "workflow-runtime-mismatch"
  | "custom";

export interface INodeCompatibilityReason {
  readonly code: NodeCompatibilityReasonCode;
  readonly severity: Exclude<NodeCompatibilitySeverity, "compatible">;
  readonly message: string;
  readonly sourceNodeId?: string;
  readonly targetNodeId?: string;
  readonly sourcePortId?: string;
  readonly targetPortId?: string;
  readonly propertyId?: string;
}

export interface INodeCompatibilityResult {
  readonly severity: NodeCompatibilitySeverity;
  readonly isCompatible: boolean;
  readonly reasons: ReadonlyArray<INodeCompatibilityReason>;

  hasWarnings(): boolean;
  hasIncompatibilities(): boolean;
}

export interface INodeCompatibilityContext {
  /**
   * Optional workflow context for runtime/policy-aware checks.
   */
  readonly workflow?: IWorkflow;

  /**
   * Optional graph context for connection/topology-aware checks.
   */
  readonly graph?: IWorkflowGraph;

  /**
   * Optional target runtime for validation.
   */
  readonly runtime?: RuntimeEngine;

  /**
   * Optional task context when node compatibility depends on the intended task.
   */
  readonly task?: ModelTask;

  /**
   * Optional modality context.
   */
  readonly modality?: ModelModality;
}

export interface INodeCompatibilityService {
  /**
   * Determines whether two ports can be connected.
   */
  evaluatePortCompatibility(
    sourcePort: INodePort,
    targetPort: INodePort,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult;

  /**
   * Determines whether a connection is valid given optional workflow context.
   */
  evaluateConnectionCompatibility(
    connection: IWorkflowConnection,
    context: {
      readonly sourceNode: INode;
      readonly targetNode: INode;
      readonly workflow?: IWorkflow;
      readonly graph?: IWorkflowGraph;
      readonly runtime?: RuntimeEngine;
    }
  ): INodeCompatibilityResult;

  /**
   * Determines whether one node can feed another node in principle,
   * independent of a specific connection instance.
   */
  evaluateNodeToNodeCompatibility(
    sourceNode: INode,
    targetNode: INode,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult;

  /**
   * Determines whether a node instance is compatible with a node definition,
   * useful for dynamic replacement/substitution.
   */
  evaluateNodeDefinitionCompatibility(
    node: INode,
    definition: INodeDefinition,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult;

  /**
   * Determines whether a property can bind to a given model.
   */
  evaluatePropertyModelCompatibility(
    property: INodeProperty,
    model: IModel,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult;

  /**
   * Determines whether a node is compatible with a given model compatibility profile.
   * Useful when the node has not yet selected a concrete model instance.
   */
  evaluateNodeModelCompatibility(
    node: INode,
    modelCompatibility: IModelCompatibility,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult;
}

