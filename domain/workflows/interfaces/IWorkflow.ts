import type { INode } from "../../nodes/interfaces/INode";
import type { IWorkflowConnection } from "./IWorkflowConnection";
import type { IWorkflowGraph } from "./IWorkflowGraph";
import type { RuntimeEngine } from "../../models/interfaces/IModelCompatibility";

/**
 * The root workflow aggregate.
 *
 * IWorkflow is the primary domain object representing a saved/editable
 * workflow document. It owns:
 * - nodes
 * - connections
 * - metadata
 * - workflow-level policies
 *
 * It does not expose all graph algorithms directly; those belong on IWorkflowGraph.
 */

export type WorkflowStatus =
  | "draft"
  | "ready"
  | "invalid"
  | "disabled"
  | "archived";

export type WorkflowExecutionPolicy =
  | "acyclic-only"
  | "allow-cycles"
  | "engine-defined";

export interface IWorkflowMetadata {
  /**
   * Human-facing workflow name.
   */
  readonly name: string;

  /**
   * Optional summary/description.
   */
  readonly description?: string;

  /**
   * Optional author/owner metadata.
   */
  readonly author?: string;

  /**
   * Optional tags for search/filtering.
   */
  readonly tags?: ReadonlyArray<string>;

  /**
   * Optional version label or semantic version.
   */
  readonly version?: string;
}

export interface IWorkflowAuditInfo {
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface IWorkflowRuntimeProfile {
  /**
   * Optional preferred runtime for this workflow.
   */
  readonly preferredRuntime?: RuntimeEngine;

  /**
   * Optional allowed runtimes.
   */
  readonly allowedRuntimes?: ReadonlyArray<RuntimeEngine>;
}

export interface IWorkflowValidationResult {
  readonly isValid: boolean;
  readonly messages: ReadonlyArray<string>;
  readonly invalidNodeIds: ReadonlyArray<string>;
  readonly invalidConnectionIds: ReadonlyArray<string>;
}

export interface IWorkflow {
  /**
   * Stable workflow identifier.
   */
  readonly id: string;

  /**
   * Workflow metadata.
   */
  readonly metadata: IWorkflowMetadata;

  /**
   * Current lifecycle state.
   */
  readonly status: WorkflowStatus;

  /**
   * Whether the workflow is enabled for execution.
   */
  readonly isEnabled: boolean;

  /**
   * Workflow-level runtime preferences/restrictions.
   */
  readonly runtimeProfile?: IWorkflowRuntimeProfile;

  /**
   * Graph policy used during validation and planning.
   */
  readonly executionPolicy: WorkflowExecutionPolicy;

  /**
   * Audit timestamps.
   */
  readonly audit?: IWorkflowAuditInfo;

  /**
   * Nodes owned by the workflow.
   */
  readonly nodes: ReadonlyArray<INode>;

  /**
   * Connections owned by the workflow.
   */
  readonly connections: ReadonlyArray<IWorkflowConnection>;

  /**
   * Returns a node by ID.
   */
  getNode(nodeId: string): INode | undefined;

  /**
   * Returns a connection by ID.
   */
  getConnection(connectionId: string): IWorkflowConnection | undefined;

  /**
   * Returns true when the workflow already contains the node.
   */
  hasNode(nodeId: string): boolean;

  /**
   * Returns true when the workflow already contains the connection.
   */
  hasConnection(connectionId: string): boolean;

  /**
   * Returns a new workflow with a node added.
   */
  addNode(node: INode): IWorkflow;

  /**
   * Returns a new workflow with a node replaced by ID.
   */
  updateNode(node: INode): IWorkflow;

  /**
   * Returns a new workflow with a node removed.
   * Implementations should also remove connections involving that node.
   */
  removeNode(nodeId: string): IWorkflow;

  /**
   * Returns a new workflow with a connection added.
   */
  addConnection(connection: IWorkflowConnection): IWorkflow;

  /**
   * Returns a new workflow with a connection replaced by ID.
   */
  updateConnection(connection: IWorkflowConnection): IWorkflow;

  /**
   * Returns a new workflow with a connection removed.
   */
  removeConnection(connectionId: string): IWorkflow;

  /**
   * Returns a new workflow with updated metadata.
   */
  withMetadata(metadata: IWorkflowMetadata): IWorkflow;

  /**
   * Returns a new workflow with updated status.
   */
  withStatus(status: WorkflowStatus): IWorkflow;

  /**
   * Returns a new workflow with updated enabled state.
   */
  withEnabled(isEnabled: boolean): IWorkflow;

  /**
   * Returns a new workflow with updated runtime profile.
   */
  withRuntimeProfile(
    runtimeProfile: IWorkflowRuntimeProfile | undefined
  ): IWorkflow;

  /**
   * Returns a new workflow with updated execution policy.
   */
  withExecutionPolicy(policy: WorkflowExecutionPolicy): IWorkflow;

  /**
   * Returns an operational graph view over the workflow.
   */
  toGraph(): IWorkflowGraph;

  /**
   * Validates the workflow aggregate and its graph.
   */
  validate(): IWorkflowValidationResult;

  /**
   * Returns true when the workflow is executable at a high level.
   */
  isExecutable(): boolean;
}
