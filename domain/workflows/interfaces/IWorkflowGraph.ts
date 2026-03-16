import type { INode } from "../../nodes/interfaces/INode";
import type { IWorkflowConnection } from "./IWorkflowConnection";

/**
 * Operational graph view over a workflow.
 *
 * This is intentionally separate from IWorkflow:
 * - IWorkflow represents the workflow aggregate/document
 * - IWorkflowGraph represents graph operations and analysis
 *
 * This separation allows:
 * - serialization/export on the workflow aggregate
 * - execution planning/validation on the graph
 * - alternate graph implementations later if needed
 */

export interface IWorkflowGraphValidationResult {
  readonly isValid: boolean;
  readonly messages: ReadonlyArray<string>;
  readonly invalidNodeIds: ReadonlyArray<string>;
  readonly invalidConnectionIds: ReadonlyArray<string>;
}

export interface IWorkflowGraphCycle {
  /**
   * Ordered node IDs participating in the cycle.
   */
  readonly nodeIds: ReadonlyArray<string>;

  /**
   * Ordered connection IDs participating in the cycle when known.
   */
  readonly connectionIds?: ReadonlyArray<string>;
}

export interface IWorkflowGraphLayer {
  /**
   * Zero-based layer index in topological execution order.
   */
  readonly index: number;

  /**
   * Nodes that can execute in this layer once previous layers are complete.
   */
  readonly nodes: ReadonlyArray<INode>;
}

export interface IWorkflowGraph {
  /**
   * All nodes in the graph.
   */
  readonly nodes: ReadonlyArray<INode>;

  /**
   * All connections in the graph.
   */
  readonly connections: ReadonlyArray<IWorkflowConnection>;

  /**
   * Returns a node by ID.
   */
  getNode(nodeId: string): INode | undefined;

  /**
   * Returns all inbound connections for a node.
   */
  getInboundConnections(nodeId: string): ReadonlyArray<IWorkflowConnection>;

  /**
   * Returns all outbound connections for a node.
   */
  getOutboundConnections(nodeId: string): ReadonlyArray<IWorkflowConnection>;

  /**
   * Returns inbound connections for a specific input port.
   */
  getInboundConnectionsForPort(
    nodeId: string,
    portId: string
  ): ReadonlyArray<IWorkflowConnection>;

  /**
   * Returns outbound connections for a specific output port.
   */
  getOutboundConnectionsForPort(
    nodeId: string,
    portId: string
  ): ReadonlyArray<IWorkflowConnection>;

  /**
   * Returns all predecessor nodes connected into the given node.
   */
  getPredecessors(nodeId: string): ReadonlyArray<INode>;

  /**
   * Returns all successor nodes connected out of the given node.
   */
  getSuccessors(nodeId: string): ReadonlyArray<INode>;

  /**
   * Returns all entry nodes (no active inbound data/model/dependency connections).
   */
  getEntryNodes(): ReadonlyArray<INode>;

  /**
   * Returns all exit nodes (no active outbound data/model/dependency/control connections).
   */
  getExitNodes(): ReadonlyArray<INode>;

  /**
   * Returns true if a path exists from sourceNodeId to targetNodeId.
   */
  hasPath(sourceNodeId: string, targetNodeId: string): boolean;

  /**
   * Returns true if the graph contains at least one cycle.
   */
  hasCycles(): boolean;

  /**
   * Returns detected cycles, if any.
   */
  findCycles(): ReadonlyArray<IWorkflowGraphCycle>;

  /**
   * Returns nodes in topological order when the graph is acyclic.
   * Implementations may throw or return partial results if cycles exist;
   * callers should generally check hasCycles() first.
   */
  topologicalSort(): ReadonlyArray<INode>;

  /**
   * Returns execution layers for potential parallel scheduling.
   */
  buildExecutionLayers(): ReadonlyArray<IWorkflowGraphLayer>;

  /**
   * Validates graph structure at the graph level.
   * This includes things like:
   * - missing node references in connections
   * - invalid connection directions
   * - duplicate single-cardinality inbound connections
   * - cycles, when disallowed by graph policy
   */
  validate(): IWorkflowGraphValidationResult;
}
