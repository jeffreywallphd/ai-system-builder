import type { INode } from "../nodes/interfaces/INode";
import type { INodePort } from "../nodes/interfaces/INodePort";
import type { IWorkflow } from "../workflows/interfaces/IWorkflow";
import type { IWorkflowGraph } from "../workflows/interfaces/IWorkflowGraph";
import type {
  IWorkflowConnection,
  IWorkflowConnectionEndpoint,
} from "../workflows/interfaces/IWorkflowConnection";
import { NodeCompatibilityService } from "./NodeCompatibilityService";

export type ConnectionValidationSeverity = "error" | "warning" | "info";

export type ConnectionValidationCode =
  | "source-node-missing"
  | "target-node-missing"
  | "source-port-missing"
  | "target-port-missing"
  | "self-connection"
  | "duplicate-connection"
  | "port-direction-invalid"
  | "port-type-incompatible"
  | "port-cardinality-exceeded"
  | "port-compatibility-invalid"
  | "runtime-incompatible"
  | "cycle-introduced"
  | "workflow-policy-violation"
  | "connection-disabled"
  | "custom";

export interface IConnectionValidationMessage {
  readonly code: ConnectionValidationCode;
  readonly severity: ConnectionValidationSeverity;
  readonly message: string;
  readonly sourceNodeId?: string;
  readonly targetNodeId?: string;
  readonly sourcePortId?: string;
  readonly targetPortId?: string;
  readonly connectionId?: string;
}

export interface IConnectionValidationResult {
  readonly isValid: boolean;
  readonly messages: ReadonlyArray<IConnectionValidationMessage>;
  readonly errors: ReadonlyArray<IConnectionValidationMessage>;
  readonly warnings: ReadonlyArray<IConnectionValidationMessage>;

  hasErrors(): boolean;
  hasWarnings(): boolean;
  hasCode(code: ConnectionValidationCode): boolean;
}

export interface IConnectionValidationContext {
  readonly workflow?: IWorkflow;
  readonly graph?: IWorkflowGraph;
  readonly sourceNode?: INode;
  readonly targetNode?: INode;
  readonly runtime?: string;
  readonly allowSelfConnections?: boolean;
  readonly allowDuplicateConnections?: boolean;
  readonly enforceCardinality?: boolean;
  readonly enforceExecutionPolicy?: boolean;
}

export interface IConnectionCandidate {
  readonly source: IWorkflowConnectionEndpoint;
  readonly target: IWorkflowConnectionEndpoint;
}

export class ConnectionValidationResult implements IConnectionValidationResult {
  public readonly isValid: boolean;
  public readonly messages: ReadonlyArray<IConnectionValidationMessage>;
  public readonly errors: ReadonlyArray<IConnectionValidationMessage>;
  public readonly warnings: ReadonlyArray<IConnectionValidationMessage>;

  constructor(messages: ReadonlyArray<IConnectionValidationMessage> = []) {
    this.messages = Object.freeze([...messages]);
    this.errors = Object.freeze(
      this.messages.filter((message) => message.severity === "error")
    );
    this.warnings = Object.freeze(
      this.messages.filter((message) => message.severity === "warning")
    );
    this.isValid = this.errors.length === 0;
  }

  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  public hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  public hasCode(code: ConnectionValidationCode): boolean {
    return this.messages.some((message) => message.code === code);
  }
}

export class ConnectionValidationService {
  private readonly nodeCompatibilityService: NodeCompatibilityService;

  constructor(nodeCompatibilityService?: NodeCompatibilityService) {
    this.nodeCompatibilityService =
      nodeCompatibilityService ?? new NodeCompatibilityService();
  }

  public validateConnection(
    connection: IWorkflowConnection,
    context: IConnectionValidationContext = {}
  ): IConnectionValidationResult {
    return this.validateCandidate(
      {
        source: connection.source,
        target: connection.target,
      },
      {
        ...context,
      },
      connection
    );
  }

  public validateCandidate(
    candidate: IConnectionCandidate,
    context: IConnectionValidationContext = {},
    existingConnection?: IWorkflowConnection
  ): IConnectionValidationResult {
    const messages: IConnectionValidationMessage[] = [];
    const graph = context.graph ?? context.workflow?.toGraph();

    const sourceNode =
      context.sourceNode ?? graph?.getNode(candidate.source.nodeId);
    const targetNode =
      context.targetNode ?? graph?.getNode(candidate.target.nodeId);

    if (!sourceNode) {
      messages.push({
        code: "source-node-missing",
        severity: "error",
        message: `Source node '${candidate.source.nodeId}' does not exist.`,
        sourceNodeId: candidate.source.nodeId,
        connectionId: existingConnection?.id,
      });
    }

    if (!targetNode) {
      messages.push({
        code: "target-node-missing",
        severity: "error",
        message: `Target node '${candidate.target.nodeId}' does not exist.`,
        targetNodeId: candidate.target.nodeId,
        connectionId: existingConnection?.id,
      });
    }

    if (!sourceNode || !targetNode) {
      return new ConnectionValidationResult(messages);
    }

    const sourcePort = sourceNode.getOutputPort(candidate.source.portId);
    const targetPort = targetNode.getInputPort(candidate.target.portId);

    if (!sourcePort) {
      messages.push({
        code: "source-port-missing",
        severity: "error",
        message: `Source port '${candidate.source.portId}' does not exist on node '${sourceNode.id}'.`,
        sourceNodeId: sourceNode.id,
        sourcePortId: candidate.source.portId,
        connectionId: existingConnection?.id,
      });
    }

    if (!targetPort) {
      messages.push({
        code: "target-port-missing",
        severity: "error",
        message: `Target port '${candidate.target.portId}' does not exist on node '${targetNode.id}'.`,
        targetNodeId: targetNode.id,
        targetPortId: candidate.target.portId,
        connectionId: existingConnection?.id,
      });
    }

    if (!sourcePort || !targetPort) {
      return new ConnectionValidationResult(messages);
    }

    this.validateBasicStructure(
      sourceNode,
      targetNode,
      sourcePort,
      targetPort,
      context,
      existingConnection,
      messages
    );

    this.validateCompatibility(
      sourceNode,
      targetNode,
      sourcePort,
      targetPort,
      context,
      existingConnection,
      messages
    );

    if (graph) {
      this.validateGraphConstraints(
        graph,
        sourceNode,
        targetNode,
        sourcePort,
        targetPort,
        context,
        existingConnection,
        messages
      );
    }

    return new ConnectionValidationResult(messages);
  }

  public canConnect(
    sourceNode: INode,
    sourcePort: INodePort,
    targetNode: INode,
    targetPort: INodePort,
    context: IConnectionValidationContext = {}
  ): boolean {
    return this.validateCandidate(
      {
        source: { nodeId: sourceNode.id, portId: sourcePort.id },
        target: { nodeId: targetNode.id, portId: targetPort.id },
      },
      {
        ...context,
        sourceNode,
        targetNode,
      }
    ).isValid;
  }

  public wouldIntroduceCycle(
    graph: IWorkflowGraph,
    sourceNodeId: string,
    targetNodeId: string
  ): boolean {
    if (sourceNodeId === targetNodeId) {
      return true;
    }

    return graph.hasPath(targetNodeId, sourceNodeId);
  }

  private validateBasicStructure(
    sourceNode: INode,
    targetNode: INode,
    sourcePort: INodePort,
    targetPort: INodePort,
    context: IConnectionValidationContext,
    existingConnection: IWorkflowConnection | undefined,
    messages: IConnectionValidationMessage[]
  ): void {
    if (!context.allowSelfConnections && sourceNode.id === targetNode.id) {
      messages.push({
        code: "self-connection",
        severity: "error",
        message: "A node cannot be connected to itself.",
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection?.id,
      });
    }

    if (sourcePort.direction !== "output" || targetPort.direction !== "input") {
      messages.push({
        code: "port-direction-invalid",
        severity: "error",
        message: "Connections must go from an output port to an input port.",
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection?.id,
      });
    }
  }

  private validateCompatibility(
    sourceNode: INode,
    targetNode: INode,
    sourcePort: INodePort,
    targetPort: INodePort,
    context: IConnectionValidationContext,
    existingConnection: IWorkflowConnection | undefined,
    messages: IConnectionValidationMessage[]
  ): void {
    const result = this.nodeCompatibilityService.evaluatePortCompatibility(
      sourcePort,
      targetPort,
      {
        workflow: context.workflow,
        graph: context.graph,
        runtime: context.runtime,
      }
    );

    for (const reason of result.reasons) {
      messages.push({
        code:
          reason.code === "port-direction-mismatch"
            ? "port-direction-invalid"
            : reason.code === "port-value-type-mismatch"
            ? "port-type-incompatible"
            : reason.code === "port-runtime-mismatch"
            ? "runtime-incompatible"
            : "port-compatibility-invalid",
        severity: reason.severity === "warning" ? "warning" : "error",
        message: reason.message,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection?.id,
      });
    }
  }

  private validateGraphConstraints(
    graph: IWorkflowGraph,
    sourceNode: INode,
    targetNode: INode,
    sourcePort: INodePort,
    targetPort: INodePort,
    context: IConnectionValidationContext,
    existingConnection: IWorkflowConnection | undefined,
    messages: IConnectionValidationMessage[]
  ): void {
    const enforceCardinality = context.enforceCardinality ?? true;
    const allowDuplicateConnections = context.allowDuplicateConnections ?? false;
    const enforceExecutionPolicy = context.enforceExecutionPolicy ?? true;

    const inboundForTargetPort = graph
      .getInboundConnectionsForPort(targetNode.id, targetPort.id)
      .filter((connection) => connection.id !== existingConnection?.id);

    if (
      enforceCardinality &&
      targetPort.cardinality === "one" &&
      inboundForTargetPort.length > 0
    ) {
      messages.push({
        code: "port-cardinality-exceeded",
        severity: "error",
        message: `Input port '${targetPort.id}' on node '${targetNode.id}' accepts only one inbound connection.`,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection?.id,
      });
    }

    const duplicateExists = graph.connections.some(
      (connection) =>
        connection.id !== existingConnection?.id &&
        connection.source.nodeId === sourceNode.id &&
        connection.source.portId === sourcePort.id &&
        connection.target.nodeId === targetNode.id &&
        connection.target.portId === targetPort.id
    );

    if (!allowDuplicateConnections && duplicateExists) {
      messages.push({
        code: "duplicate-connection",
        severity: "error",
        message: "An identical connection already exists in the workflow.",
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection?.id,
      });
    }

    const workflow = context.workflow;
    if (
      enforceExecutionPolicy &&
      workflow &&
      workflow.executionPolicy === "acyclic-only" &&
      this.wouldIntroduceCycle(graph, sourceNode.id, targetNode.id)
    ) {
      messages.push({
        code: "cycle-introduced",
        severity: "error",
        message:
          "Adding this connection would introduce a cycle in an acyclic-only workflow.",
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection?.id,
      });

      messages.push({
        code: "workflow-policy-violation",
        severity: "error",
        message: "The workflow execution policy does not allow cycles.",
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection?.id,
      });
    }

    if (existingConnection && !existingConnection.isEnabled) {
      messages.push({
        code: "connection-disabled",
        severity: "info",
        message: `Connection '${existingConnection.id}' is currently disabled.`,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
        connectionId: existingConnection.id,
      });
    }
  }
}
