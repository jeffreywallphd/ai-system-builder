import type { INode } from "../nodes/interfaces/INode";
import type { IWorkflow } from "../workflows/interfaces/IWorkflow";
import type { IWorkflowConnection } from "../workflows/interfaces/IWorkflowConnection";
import type {
  IWorkflowGraph,
  IWorkflowGraphCycle,
  IWorkflowGraphLayer,
} from "../workflows/interfaces/IWorkflowGraph";
import { WorkflowGraph } from "../workflows/WorkflowGraph";

export interface IWorkflowGraphComponent {
  readonly nodeIds: ReadonlyArray<string>;
  readonly connectionIds: ReadonlyArray<string>;
}

export interface IWorkflowExecutionPlan {
  readonly layers: ReadonlyArray<IWorkflowGraphLayer>;
  readonly entryNodes: ReadonlyArray<INode>;
  readonly exitNodes: ReadonlyArray<INode>;
  readonly hasCycles: boolean;
  readonly cycles: ReadonlyArray<IWorkflowGraphCycle>;
}

export class WorkflowExecutionPlan implements IWorkflowExecutionPlan {
  public readonly layers: ReadonlyArray<IWorkflowGraphLayer>;
  public readonly entryNodes: ReadonlyArray<INode>;
  public readonly exitNodes: ReadonlyArray<INode>;
  public readonly hasCycles: boolean;
  public readonly cycles: ReadonlyArray<IWorkflowGraphCycle>;

  constructor(params: {
    layers: ReadonlyArray<IWorkflowGraphLayer>;
    entryNodes: ReadonlyArray<INode>;
    exitNodes: ReadonlyArray<INode>;
    hasCycles: boolean;
    cycles: ReadonlyArray<IWorkflowGraphCycle>;
  }) {
    this.layers = Object.freeze([...params.layers]);
    this.entryNodes = Object.freeze([...params.entryNodes]);
    this.exitNodes = Object.freeze([...params.exitNodes]);
    this.hasCycles = params.hasCycles;
    this.cycles = Object.freeze([...params.cycles]);
  }
}

export class WorkflowGraphComponent implements IWorkflowGraphComponent {
  public readonly nodeIds: ReadonlyArray<string>;
  public readonly connectionIds: ReadonlyArray<string>;

  constructor(params: {
    nodeIds: ReadonlyArray<string>;
    connectionIds: ReadonlyArray<string>;
  }) {
    this.nodeIds = Object.freeze([...params.nodeIds]);
    this.connectionIds = Object.freeze([...params.connectionIds]);
  }
}

export class WorkflowGraphService {
  public fromWorkflow(workflow: IWorkflow): IWorkflowGraph {
    return workflow.toGraph();
  }

  public cloneGraph(graph: IWorkflowGraph): IWorkflowGraph {
    return new WorkflowGraph({
      nodes: graph.nodes,
      connections: graph.connections,
    });
  }

  public getReachableNodesFrom(
    graph: IWorkflowGraph,
    startNodeIds: ReadonlyArray<string>
  ): ReadonlyArray<INode> {
    const visited = new Set<string>();
    const stack = [...startNodeIds];
    const result: INode[] = [];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      const node = graph.getNode(nodeId);
      if (!node) {
        continue;
      }

      result.push(node);

      for (const successor of graph.getSuccessors(nodeId)) {
        if (!visited.has(successor.id)) {
          stack.push(successor.id);
        }
      }
    }

    return Object.freeze(result);
  }

  public getAncestors(
    graph: IWorkflowGraph,
    nodeId: string
  ): ReadonlyArray<INode> {
    const visited = new Set<string>();
    const stack = [nodeId];
    const ancestors: INode[] = [];

    while (stack.length > 0) {
      const currentNodeId = stack.pop()!;

      for (const predecessor of graph.getPredecessors(currentNodeId)) {
        if (visited.has(predecessor.id)) {
          continue;
        }

        visited.add(predecessor.id);
        ancestors.push(predecessor);
        stack.push(predecessor.id);
      }
    }

    return Object.freeze(ancestors);
  }

  public getDescendants(
    graph: IWorkflowGraph,
    nodeId: string
  ): ReadonlyArray<INode> {
    const visited = new Set<string>();
    const stack = [nodeId];
    const descendants: INode[] = [];

    while (stack.length > 0) {
      const currentNodeId = stack.pop()!;

      for (const successor of graph.getSuccessors(currentNodeId)) {
        if (visited.has(successor.id)) {
          continue;
        }

        visited.add(successor.id);
        descendants.push(successor);
        stack.push(successor.id);
      }
    }

    return Object.freeze(descendants);
  }

  public getUnreachableNodes(
    graph: IWorkflowGraph
  ): ReadonlyArray<INode> {
    const entryNodes = graph.getEntryNodes();

    if (entryNodes.length === 0) {
      return Object.freeze([...graph.nodes]);
    }

    const reachableIds = new Set(
      this.getReachableNodesFrom(
        graph,
        entryNodes.map((node) => node.id)
      ).map((node) => node.id)
    );

    return Object.freeze(
      graph.nodes.filter((node) => !reachableIds.has(node.id))
    );
  }

  public getDisconnectedComponents(
    graph: IWorkflowGraph
  ): ReadonlyArray<IWorkflowGraphComponent> {
    const visited = new Set<string>();
    const components: WorkflowGraphComponent[] = [];

    const collectNeighborIds = (nodeId: string): string[] => {
      const predecessorIds = graph
        .getPredecessors(nodeId)
        .map((node) => node.id);
      const successorIds = graph.getSuccessors(nodeId).map((node) => node.id);

      return [...predecessorIds, ...successorIds];
    };

    for (const node of graph.nodes) {
      if (visited.has(node.id)) {
        continue;
      }

      const stack = [node.id];
      const componentNodeIds: string[] = [];
      const componentConnectionIds = new Set<string>();

      while (stack.length > 0) {
        const currentNodeId = stack.pop()!;

        if (visited.has(currentNodeId)) {
          continue;
        }

        visited.add(currentNodeId);
        componentNodeIds.push(currentNodeId);

        for (const connection of graph.getInboundConnections(currentNodeId)) {
          componentConnectionIds.add(connection.id);
        }

        for (const connection of graph.getOutboundConnections(currentNodeId)) {
          componentConnectionIds.add(connection.id);
        }

        for (const neighborId of collectNeighborIds(currentNodeId)) {
          if (!visited.has(neighborId)) {
            stack.push(neighborId);
          }
        }
      }

      components.push(
        new WorkflowGraphComponent({
          nodeIds: componentNodeIds,
          connectionIds: [...componentConnectionIds],
        })
      );
    }

    return Object.freeze(components);
  }

  public getExecutableNodes(
    graph: IWorkflowGraph
  ): ReadonlyArray<INode> {
    return Object.freeze(graph.nodes.filter((node) => node.isExecutable()));
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

  public createGraphWithConnection(
    graph: IWorkflowGraph,
    connection: IWorkflowConnection
  ): IWorkflowGraph {
    return new WorkflowGraph({
      nodes: graph.nodes,
      connections: [...graph.connections, connection],
    });
  }

  public createGraphWithoutConnection(
    graph: IWorkflowGraph,
    connectionId: string
  ): IWorkflowGraph {
    return new WorkflowGraph({
      nodes: graph.nodes,
      connections: graph.connections.filter(
        (connection) => connection.id !== connectionId
      ),
    });
  }

  public createGraphWithoutNode(
    graph: IWorkflowGraph,
    nodeId: string
  ): IWorkflowGraph {
    return new WorkflowGraph({
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      connections: graph.connections.filter(
        (connection) => !connection.involvesNode(nodeId)
      ),
    });
  }

  public buildExecutionPlan(graph: IWorkflowGraph): IWorkflowExecutionPlan {
    const cycles = graph.findCycles();
    const hasCycles = cycles.length > 0;

    let layers: ReadonlyArray<IWorkflowGraphLayer> = [];

    if (!hasCycles) {
      layers = graph.buildExecutionLayers();
    }

    return new WorkflowExecutionPlan({
      layers,
      entryNodes: graph.getEntryNodes(),
      exitNodes: graph.getExitNodes(),
      hasCycles,
      cycles,
    });
  }

  public sortNodesForExecution(
    graph: IWorkflowGraph
  ): ReadonlyArray<INode> {
    if (graph.hasCycles()) {
      throw new Error(
        "Cannot produce a topological execution order for a cyclic graph."
      );
    }

    return graph.topologicalSort();
  }

  public findConnectionsBetween(
    graph: IWorkflowGraph,
    sourceNodeId: string,
    targetNodeId: string
  ): ReadonlyArray<IWorkflowConnection> {
    return Object.freeze(
      graph.connections.filter(
        (connection) =>
          connection.source.nodeId === sourceNodeId &&
          connection.target.nodeId === targetNodeId
      )
    );
  }

  public getIncomingDependencyNodes(
    graph: IWorkflowGraph,
    nodeId: string
  ): ReadonlyArray<INode> {
    const dependencyConnections = graph
      .getInboundConnections(nodeId)
      .filter((connection) => connection.kind === "dependency");

    const nodes = dependencyConnections
      .map((connection) => graph.getNode(connection.source.nodeId))
      .filter((node): node is INode => !!node);

    return Object.freeze(nodes);
  }

  public getSubgraphForNodes(
    graph: IWorkflowGraph,
    nodeIds: ReadonlyArray<string>
  ): IWorkflowGraph {
    const nodeIdSet = new Set(nodeIds);

    return new WorkflowGraph({
      nodes: graph.nodes.filter((node) => nodeIdSet.has(node.id)),
      connections: graph.connections.filter(
        (connection) =>
          nodeIdSet.has(connection.source.nodeId) &&
          nodeIdSet.has(connection.target.nodeId)
      ),
    });
  }
}
