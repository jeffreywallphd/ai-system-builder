import type { INode } from "../../../domain/nodes/interfaces/INode";
import type { INodePort } from "../../../domain/nodes/interfaces/INodePort";
import type { IWorkflowGraph, IWorkflowGraphCycle, IWorkflowGraphLayer, IWorkflowGraphValidationResult } from "./interfaces/IWorkflowGraph";
import type { IWorkflowConnection } from "./interfaces/IWorkflowConnection";

function uniqueById<T extends { id: string }>(items: ReadonlyArray<T>): ReadonlyArray<T> {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(item.id, item);
  }

  return Object.freeze([...map.values()]);
}

function activeConnections(
  connections: ReadonlyArray<IWorkflowConnection>
): ReadonlyArray<IWorkflowConnection> {
  return connections.filter((connection) => connection.isActive());
}

export class WorkflowGraphCycle implements IWorkflowGraphCycle {
  public readonly nodeIds: ReadonlyArray<string>;
  public readonly connectionIds?: ReadonlyArray<string>;

  constructor(params: {
    nodeIds: ReadonlyArray<string>;
    connectionIds?: ReadonlyArray<string>;
  }) {
    this.nodeIds = Object.freeze([...params.nodeIds]);
    this.connectionIds = params.connectionIds
      ? Object.freeze([...params.connectionIds])
      : undefined;
  }
}

export class WorkflowGraphLayer implements IWorkflowGraphLayer {
  public readonly index: number;
  public readonly nodes: ReadonlyArray<INode>;

  constructor(index: number, nodes: ReadonlyArray<INode>) {
    this.index = index;
    this.nodes = Object.freeze([...nodes]);
  }
}

export class WorkflowGraphValidationResult
  implements IWorkflowGraphValidationResult
{
  public readonly isValid: boolean;
  public readonly messages: ReadonlyArray<string>;
  public readonly invalidNodeIds: ReadonlyArray<string>;
  public readonly invalidConnectionIds: ReadonlyArray<string>;

  constructor(params: {
    isValid: boolean;
    messages?: ReadonlyArray<string>;
    invalidNodeIds?: ReadonlyArray<string>;
    invalidConnectionIds?: ReadonlyArray<string>;
  }) {
    this.isValid = params.isValid;
    this.messages = Object.freeze([...(params.messages ?? [])]);
    this.invalidNodeIds = Object.freeze([...(params.invalidNodeIds ?? [])]);
    this.invalidConnectionIds = Object.freeze([
      ...(params.invalidConnectionIds ?? []),
    ]);
  }
}

export class WorkflowGraph implements IWorkflowGraph {
  public readonly nodes: ReadonlyArray<INode>;
  public readonly connections: ReadonlyArray<IWorkflowConnection>;

  private readonly nodeMap: ReadonlyMap<string, INode>;

  constructor(params: {
    nodes?: ReadonlyArray<INode>;
    connections?: ReadonlyArray<IWorkflowConnection>;
  } = {}) {
    this.nodes = uniqueById(params.nodes ?? []);
    this.connections = uniqueById(params.connections ?? []);
    this.nodeMap = new Map(this.nodes.map((node) => [node.id, node]));
  }

  public getNode(nodeId: string): INode | undefined {
    return this.nodeMap.get(nodeId);
  }

  public getInboundConnections(nodeId: string): ReadonlyArray<IWorkflowConnection> {
    return Object.freeze(
      activeConnections(this.connections).filter(
        (connection) => connection.target.nodeId === nodeId
      )
    );
  }

  public getOutboundConnections(nodeId: string): ReadonlyArray<IWorkflowConnection> {
    return Object.freeze(
      activeConnections(this.connections).filter(
        (connection) => connection.source.nodeId === nodeId
      )
    );
  }

  public getInboundConnectionsForPort(
    nodeId: string,
    portId: string
  ): ReadonlyArray<IWorkflowConnection> {
    return Object.freeze(
      activeConnections(this.connections).filter(
        (connection) =>
          connection.target.nodeId === nodeId &&
          connection.target.portId === portId
      )
    );
  }

  public getOutboundConnectionsForPort(
    nodeId: string,
    portId: string
  ): ReadonlyArray<IWorkflowConnection> {
    return Object.freeze(
      activeConnections(this.connections).filter(
        (connection) =>
          connection.source.nodeId === nodeId &&
          connection.source.portId === portId
      )
    );
  }

  public getPredecessors(nodeId: string): ReadonlyArray<INode> {
    const predecessors = this.getInboundConnections(nodeId)
      .map((connection) => this.getNode(connection.source.nodeId))
      .filter((node): node is INode => !!node);

    return uniqueById(predecessors);
  }

  public getSuccessors(nodeId: string): ReadonlyArray<INode> {
    const successors = this.getOutboundConnections(nodeId)
      .map((connection) => this.getNode(connection.target.nodeId))
      .filter((node): node is INode => !!node);

    return uniqueById(successors);
  }

  public getEntryNodes(): ReadonlyArray<INode> {
    return Object.freeze(
      this.nodes.filter((node) => this.getInboundConnections(node.id).length === 0)
    );
  }

  public getExitNodes(): ReadonlyArray<INode> {
    return Object.freeze(
      this.nodes.filter((node) => this.getOutboundConnections(node.id).length === 0)
    );
  }

  public hasPath(sourceNodeId: string, targetNodeId: string): boolean {
    if (sourceNodeId === targetNodeId) {
      return true;
    }

    const visited = new Set<string>();
    const stack = [sourceNodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      for (const successor of this.getSuccessors(current)) {
        if (successor.id === targetNodeId) {
          return true;
        }

        if (!visited.has(successor.id)) {
          stack.push(successor.id);
        }
      }
    }

    return false;
  }

  public hasCycles(): boolean {
    return this.findCycles().length > 0;
  }

  public findCycles(): ReadonlyArray<IWorkflowGraphCycle> {
    const cycles: WorkflowGraphCycle[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      inStack.add(nodeId);
      path.push(nodeId);

      for (const successor of this.getSuccessors(nodeId)) {
        if (!visited.has(successor.id)) {
          dfs(successor.id);
        } else if (inStack.has(successor.id)) {
          const startIndex = path.indexOf(successor.id);

          if (startIndex >= 0) {
            const cycleNodeIds = [...path.slice(startIndex), successor.id];
            const connectionIds: string[] = [];

            for (let index = 0; index < cycleNodeIds.length - 1; index += 1) {
              const from = cycleNodeIds[index];
              const to = cycleNodeIds[index + 1];
              const connection = activeConnections(this.connections).find(
                (candidate) =>
                  candidate.source.nodeId === from &&
                  candidate.target.nodeId === to
              );

              if (connection) {
                connectionIds.push(connection.id);
              }
            }

            const cycle = new WorkflowGraphCycle({
              nodeIds: cycleNodeIds,
              connectionIds,
            });

            const duplicate = cycles.some(
              (existing) => JSON.stringify(existing.nodeIds) === JSON.stringify(cycle.nodeIds)
            );

            if (!duplicate) {
              cycles.push(cycle);
            }
          }
        }
      }

      path.pop();
      inStack.delete(nodeId);
    };

    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return Object.freeze(cycles);
  }

  public topologicalSort(): ReadonlyArray<INode> {
    const inboundCounts = new Map<string, number>(
      this.nodes.map((node) => [node.id, 0])
    );

    for (const connection of activeConnections(this.connections)) {
      inboundCounts.set(
        connection.target.nodeId,
        (inboundCounts.get(connection.target.nodeId) ?? 0) + 1
      );
    }

    const queue = this.nodes
      .filter((node) => (inboundCounts.get(node.id) ?? 0) === 0)
      .map((node) => node.id);

    const result: INode[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = this.getNode(nodeId);

      if (!node) {
        continue;
      }

      result.push(node);

      for (const connection of this.getOutboundConnections(nodeId)) {
        const targetId = connection.target.nodeId;
        const nextCount = (inboundCounts.get(targetId) ?? 0) - 1;
        inboundCounts.set(targetId, nextCount);

        if (nextCount === 0) {
          queue.push(targetId);
        }
      }
    }

    if (result.length !== this.nodes.length) {
      throw new Error("WorkflowGraph cannot be topologically sorted because it contains cycles.");
    }

    return Object.freeze(result);
  }

  public buildExecutionLayers(): ReadonlyArray<IWorkflowGraphLayer> {
    const inboundCounts = new Map<string, number>(
      this.nodes.map((node) => [node.id, 0])
    );

    for (const connection of activeConnections(this.connections)) {
      inboundCounts.set(
        connection.target.nodeId,
        (inboundCounts.get(connection.target.nodeId) ?? 0) + 1
      );
    }

    let currentLayerNodeIds = this.nodes
      .filter((node) => (inboundCounts.get(node.id) ?? 0) === 0)
      .map((node) => node.id);

    const layers: WorkflowGraphLayer[] = [];
    let layerIndex = 0;
    let processedCount = 0;

    while (currentLayerNodeIds.length > 0) {
      const layerNodes = currentLayerNodeIds
        .map((nodeId) => this.getNode(nodeId))
        .filter((node): node is INode => !!node);

      layers.push(new WorkflowGraphLayer(layerIndex, layerNodes));
      processedCount += layerNodes.length;

      const nextLayerNodeIds: string[] = [];

      for (const nodeId of currentLayerNodeIds) {
        for (const connection of this.getOutboundConnections(nodeId)) {
          const targetId = connection.target.nodeId;
          const nextCount = (inboundCounts.get(targetId) ?? 0) - 1;
          inboundCounts.set(targetId, nextCount);

          if (nextCount === 0) {
            nextLayerNodeIds.push(targetId);
          }
        }
      }

      currentLayerNodeIds = nextLayerNodeIds;
      layerIndex += 1;
    }

    if (processedCount !== this.nodes.length) {
      throw new Error("WorkflowGraph cannot build execution layers because it contains cycles.");
    }

    return Object.freeze(layers);
  }

  public validate(): IWorkflowGraphValidationResult {
    const messages: string[] = [];
    const invalidNodeIds = new Set<string>();
    const invalidConnectionIds = new Set<string>();

    for (const node of this.nodes) {
      const result = node.validate();

      if (!result.isValid) {
        invalidNodeIds.add(node.id);
        messages.push(...result.messages.map((message) => `[Node ${node.id}] ${message}`));
      }
    }

    for (const connection of this.connections) {
      const sourceNode = this.getNode(connection.source.nodeId);
      const targetNode = this.getNode(connection.target.nodeId);

      if (!sourceNode) {
        invalidConnectionIds.add(connection.id);
        messages.push(
          `[Connection ${connection.id}] Source node '${connection.source.nodeId}' does not exist.`
        );
        continue;
      }

      if (!targetNode) {
        invalidConnectionIds.add(connection.id);
        messages.push(
          `[Connection ${connection.id}] Target node '${connection.target.nodeId}' does not exist.`
        );
        continue;
      }

      const sourcePort = sourceNode.getOutputPort(connection.source.portId);
      const targetPort = targetNode.getInputPort(connection.target.portId);

      if (!sourcePort) {
        invalidConnectionIds.add(connection.id);
        messages.push(
          `[Connection ${connection.id}] Source port '${connection.source.portId}' does not exist on node '${sourceNode.id}'.`
        );
        continue;
      }

      if (!targetPort) {
        invalidConnectionIds.add(connection.id);
        messages.push(
          `[Connection ${connection.id}] Target port '${connection.target.portId}' does not exist on node '${targetNode.id}'.`
        );
        continue;
      }

      if (!sourcePort.canConnectTo(targetPort)) {
        invalidConnectionIds.add(connection.id);
        messages.push(
          `[Connection ${connection.id}] Source port '${sourcePort.id}' cannot connect to target port '${targetPort.id}'.`
        );
      }
    }

    for (const node of this.nodes) {
      for (const inputPort of node.inputPorts) {
        if (inputPort.cardinality === "many") {
          continue;
        }

        const inbound = this.getInboundConnectionsForPort(node.id, inputPort.id);

        if (inbound.length > 1) {
          invalidConnectionIds.add(inbound[0].id);
          messages.push(
            `[Node ${node.id}] Input port '${inputPort.id}' accepts only one inbound connection.`
          );
        }
      }
    }

    const cycles = this.findCycles();

    if (cycles.length > 0) {
      for (const cycle of cycles) {
        messages.push(
          `[Graph] Cycle detected: ${cycle.nodeIds.join(" -> ")}`
        );

        cycle.connectionIds?.forEach((connectionId) =>
          invalidConnectionIds.add(connectionId)
        );
      }
    }

    return new WorkflowGraphValidationResult({
      isValid: messages.length === 0,
      messages,
      invalidNodeIds: [...invalidNodeIds],
      invalidConnectionIds: [...invalidConnectionIds],
    });
  }

  public static from(params: {
    nodes?: ReadonlyArray<INode>;
    connections?: ReadonlyArray<IWorkflowConnection>;
  }): WorkflowGraph {
    return new WorkflowGraph(params);
  }
}
