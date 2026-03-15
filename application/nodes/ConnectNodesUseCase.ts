import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowConnection,
  IWorkflowConnectionCompatibilitySnapshot,
  IWorkflowConnectionMetadata,
  WorkflowConnectionKind,
  WorkflowConnectionState,
} from "../../domain/workflows/interfaces/IWorkflowConnection";
import type { INode } from "../../domain/nodes/interfaces/INode";
import type { INodePort, NodePortValueType } from "../../domain/nodes/interfaces/INodePort";
import type { INodeCompatibilityService } from "../../domain/services/interfaces/INodeCompatibilityService";
import { WorkflowConnection } from "../../domain/workflows/WorkflowConnection";

export interface IConnectNodesRequest {
  readonly workflow: IWorkflow;
  readonly sourceNodeId: string;
  readonly sourcePortId: string;
  readonly targetNodeId: string;
  readonly targetPortId: string;
  readonly connectionId?: string;
  readonly kind?: WorkflowConnectionKind;
  readonly state?: WorkflowConnectionState;
  readonly isEnabled?: boolean;
  readonly order?: number;
  readonly metadata?: IWorkflowConnectionMetadata;
}

export interface IConnectNodesResult {
  readonly workflow: IWorkflow;
  readonly connection: IWorkflowConnection;
  readonly sourceNode: INode;
  readonly targetNode: INode;
}

export class ConnectNodesUseCase {
  private readonly nodeCompatibilityService: INodeCompatibilityService;
  private readonly createId: () => string;

  constructor(
    nodeCompatibilityService: INodeCompatibilityService,
    createId?: () => string
  ) {
    this.nodeCompatibilityService = nodeCompatibilityService;
    this.createId = createId ?? defaultIdFactory;
  }

  public execute(request: IConnectNodesRequest): IConnectNodesResult {
    const sourceNode = request.workflow.getNode(request.sourceNodeId.trim());
    const targetNode = request.workflow.getNode(request.targetNodeId.trim());

    if (!sourceNode) {
      throw new Error(`Source node '${request.sourceNodeId.trim()}' was not found.`);
    }

    if (!targetNode) {
      throw new Error(`Target node '${request.targetNodeId.trim()}' was not found.`);
    }

    const sourcePort = sourceNode.getOutputPort(request.sourcePortId.trim());
    const targetPort = targetNode.getInputPort(request.targetPortId.trim());

    if (!sourcePort) {
      throw new Error(
        `Source port '${request.sourcePortId.trim()}' was not found on node '${sourceNode.id}'.`
      );
    }

    if (!targetPort) {
      throw new Error(
        `Target port '${request.targetPortId.trim()}' was not found on node '${targetNode.id}'.`
      );
    }

    const duplicateConnection = request.workflow.connections.find(
      (connection) =>
        connection.source.nodeId === sourceNode.id &&
        connection.source.portId === sourcePort.id &&
        connection.target.nodeId === targetNode.id &&
        connection.target.portId === targetPort.id
    );

    if (duplicateConnection) {
      throw new Error(
        `A connection already exists from '${sourceNode.id}:${sourcePort.id}' to '${targetNode.id}:${targetPort.id}'.`
      );
    }

    if (targetPort.cardinality === "one") {
      const inbound = request.workflow
        .toGraph()
        .getInboundConnectionsForPort(targetNode.id, targetPort.id);

      if (inbound.length > 0) {
        throw new Error(
          `Target port '${targetNode.id}:${targetPort.id}' accepts only one inbound connection.`
        );
      }
    }

    const compatibility = this.nodeCompatibilityService.evaluatePortCompatibility(
      sourcePort,
      targetPort,
      {
        workflow: request.workflow,
        graph: request.workflow.toGraph(),
        runtime:
          request.workflow.runtimeProfile?.preferredRuntime,
      }
    );

    if (!compatibility.isCompatible) {
      throw new Error(
        `Ports are incompatible: ${compatibility.reasons
          .map((reason) => reason.message)
          .join(" | ")}`
      );
    }

    if (
      request.workflow.executionPolicy === "acyclic-only" &&
      request.workflow.toGraph().hasPath(targetNode.id, sourceNode.id)
    ) {
      throw new Error(
        `Connecting '${sourceNode.id}' to '${targetNode.id}' would introduce a cycle, which is not allowed by the workflow policy.`
      );
    }

    const connection = new WorkflowConnection({
      id: request.connectionId?.trim() || this.createId(),
      source: {
        nodeId: sourceNode.id,
        portId: sourcePort.id,
      },
      target: {
        nodeId: targetNode.id,
        portId: targetPort.id,
      },
      kind: request.kind ?? inferConnectionKind(sourcePort, targetPort),
      state: request.state ?? "active",
      isEnabled: request.isEnabled ?? true,
      order: request.order,
      metadata: request.metadata,
      compatibilitySnapshot: createCompatibilitySnapshot(sourcePort, targetPort),
    });

    const workflow = request.workflow.addConnection(connection);

    return Object.freeze({
      workflow,
      connection,
      sourceNode,
      targetNode,
    });
  }
}

function inferConnectionKind(
  sourcePort: INodePort,
  targetPort: INodePort
): WorkflowConnectionKind {
  if (sourcePort.isControlPort || targetPort.isControlPort) {
    return "control";
  }

  if (sourcePort.carriesModelData() || targetPort.carriesModelData()) {
    return "model";
  }

  if (sourcePort.expectsDependencies() || targetPort.expectsDependencies()) {
    return "dependency";
  }

  return "data";
}

function createCompatibilitySnapshot(
  sourcePort: INodePort,
  targetPort: INodePort
): IWorkflowConnectionCompatibilitySnapshot {
  const valueTypes = intersectValueTypes(
    sourcePort.compatibility.valueTypes,
    targetPort.compatibility.valueTypes,
    sourcePort.compatibility.allowsAnyValueType,
    targetPort.compatibility.allowsAnyValueType
  );

  return Object.freeze({
    valueTypes,
    modelCompatibility:
      sourcePort.compatibility.modelCompatibility ??
      targetPort.compatibility.modelCompatibility,
  });
}

function intersectValueTypes(
  sourceTypes: ReadonlyArray<NodePortValueType>,
  targetTypes: ReadonlyArray<NodePortValueType>,
  sourceAllowsAny: boolean,
  targetAllowsAny: boolean
): ReadonlyArray<NodePortValueType> | undefined {
  if (sourceAllowsAny && targetAllowsAny) {
    return undefined;
  }

  if (sourceAllowsAny) {
    return Object.freeze([...targetTypes]);
  }

  if (targetAllowsAny) {
    return Object.freeze([...sourceTypes]);
  }

  const targetSet = new Set(targetTypes);
  const intersection = sourceTypes.filter((type) => targetSet.has(type));

  return intersection.length > 0 ? Object.freeze(intersection) : undefined;
}

function defaultIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `connection_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
