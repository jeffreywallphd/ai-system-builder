import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeMouseHandler,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type OnConnect,
} from "@xyflow/react";
import type { NodeDetailViewModel } from "../../../presenters/NodePresenter";
import type { WorkflowResponse } from "../../../application/dto/WorkflowResponse";
import { NodeAdapter, type ReactFlowNodeData } from "./NodeAdapter";
import { createReactFlowEdgeId, EdgeAdapter } from "./EdgeAdapter";
import ReactFlowNodeWrapper from "./ReactFlowNodeWrapper";

export interface ReactFlowCanvasProps {
  readonly nodes: ReadonlyArray<NodeDetailViewModel>;
  readonly workflow?: WorkflowResponse;
  readonly selectedNodeId?: string;
  readonly selectedConnectionId?: string;
  readonly fitViewNonce?: number;
  readonly isCompactViewport?: boolean;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onSelectConnection?: (connectionId: string) => void;
  readonly onClearSelection?: () => void;
  readonly onMoveNodeCommit?: (
    nodeId: string,
    position: { readonly x: number; readonly y: number }
  ) => void;
  readonly onResolveNodePlacement?: (
    nodeId: string,
    position: { readonly x: number; readonly y: number }
  ) => { readonly x: number; readonly y: number };
  readonly onConnectNodes?: (request: {
    readonly sourceNodeId: string;
    readonly sourcePortId: string;
    readonly targetNodeId: string;
    readonly targetPortId: string;
  }) => void;
  readonly onOpenNodeProperties?: (nodeId: string) => void;
  readonly onNodePropertyChange?: (
    nodeId: string,
    propertyId: string,
    value: unknown
  ) => void;
  readonly onRemoveNode?: (nodeId: string) => void;
  readonly nodeExecutionOutputs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

const nodeTypes = Object.freeze({
  aiLoomNode: ReactFlowNodeWrapper,
});

function syncInteractiveNodes(
  currentNodes: ReadonlyArray<Node<ReactFlowNodeData>>,
  nextNodes: ReadonlyArray<Node<ReactFlowNodeData>>
): ReadonlyArray<Node<ReactFlowNodeData>> {
  const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]));

  return nextNodes.map((node) => {
    const existingNode = currentNodesById.get(node.id);
    if (!existingNode) {
      return node;
    }

    return {
      ...existingNode,
      ...node,
      data: node.data,
      position: node.position,
      selected: node.selected,
    };
  });
}

export function syncInteractiveEdges(
  currentEdges: ReadonlyArray<Edge>,
  nextEdges: ReadonlyArray<Edge>
): ReadonlyArray<Edge> {
  const currentEdgesById = new Map(currentEdges.map((edge) => [edge.id, edge]));

  return nextEdges.map((edge) => {
    const existingEdge = currentEdgesById.get(edge.id);
    if (!existingEdge) {
      return edge;
    }

    return {
      ...existingEdge,
      ...edge,
      selected: edge.selected,
      animated: edge.animated,
    };
  });
}

export function createOptimisticEdgeFromConnection(
  connection: Connection
): Edge | undefined {
  if (
    !connection.source ||
    !connection.sourceHandle ||
    !connection.target ||
    !connection.targetHandle
  ) {
    return undefined;
  }

  return Object.freeze({
    id: createReactFlowEdgeId({
      sourceNodeId: connection.source,
      sourcePortId: connection.sourceHandle,
      targetNodeId: connection.target,
      targetPortId: connection.targetHandle,
    }),
    source: connection.source,
    sourceHandle: connection.sourceHandle,
    target: connection.target,
    targetHandle: connection.targetHandle,
    type: "smoothstep",
    animated: true,
    selectable: false,
    zIndex: 1,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: "rgba(120, 187, 255, 0.98)",
    },
    style: {
      stroke: "rgba(120, 187, 255, 0.98)",
      strokeWidth: 3,
    },
    pathOptions: {
      borderRadius: 20,
      offset: 24,
    },
    data: Object.freeze({
      connectionId: undefined,
      state: "pending",
      isOptimistic: true,
    }),
  });
}

function InnerReactFlowCanvas({
  nodes,
  workflow,
  selectedNodeId,
  selectedConnectionId,
  fitViewNonce,
  isCompactViewport,
  onSelectNode,
  onSelectConnection,
  onClearSelection,
  onMoveNodeCommit,
  onResolveNodePlacement,
  onConnectNodes,
  onOpenNodeProperties,
  onNodePropertyChange,
  onRemoveNode,
  nodeExecutionOutputs,
}: ReactFlowCanvasProps): JSX.Element {
  const nodeAdapter = useMemo(() => new NodeAdapter(), []);
  const edgeAdapter = useMemo(() => new EdgeAdapter(), []);
  const reactFlow = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  const flowNodes = useMemo(
    () =>
      nodeAdapter.toReactFlowNodes(nodes, {
        isCompactViewport,
        onOpenProperties: onOpenNodeProperties,
        onPropertyChange: onNodePropertyChange,
        onRemoveNode,
        nodeExecutionOutputs,
      }),
    [
      isCompactViewport,
      nodeAdapter,
      nodes,
      onNodePropertyChange,
      onOpenNodeProperties,
      onRemoveNode,
      nodeExecutionOutputs,
    ]
  );

  const flowEdges = useMemo(
    () => edgeAdapter.toReactFlowEdges(workflow),
    [edgeAdapter, workflow]
  );

  const renderedNodes = useMemo<ReadonlyArray<Node<ReactFlowNodeData>>>(
    () =>
      flowNodes.map((node) =>
        node.id === selectedNodeId
          ? Object.freeze({ ...node, selected: true })
          : node
      ),
    [flowNodes, selectedNodeId]
  );

  const renderedEdges = useMemo<ReadonlyArray<Edge>>(
    () =>
      flowEdges.map((edge) =>
        edge.data?.connectionId === selectedConnectionId
          ? Object.freeze({
              ...edge,
              selected: true,
              animated: true,
            })
          : edge
      ),
    [flowEdges, selectedConnectionId]
  );

  const [interactiveNodes, setInteractiveNodes] = useState<ReadonlyArray<Node<ReactFlowNodeData>>>(renderedNodes);
  const [interactiveEdges, setInteractiveEdges] = useState<ReadonlyArray<Edge>>(renderedEdges);
  const settleAnimationFrameRef = useRef<number>();

  useEffect(() => {
    setInteractiveNodes((currentNodes) =>
      syncInteractiveNodes(currentNodes, renderedNodes)
    );
  }, [renderedNodes]);

  useEffect(() => {
    setInteractiveEdges((currentEdges) =>
      syncInteractiveEdges(currentEdges, renderedEdges)
    );
  }, [renderedEdges]);

  useEffect(
    () => () => {
      if (settleAnimationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(settleAnimationFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) {
      return;
    }

    const fit = (): void => {
      void reactFlow.fitView({
        padding: isCompactViewport ? 0.3 : 0.18,
        duration: 250,
        includeHiddenNodes: true,
        minZoom: 0.1,
        maxZoom: 1.5,
      });
    };

    const frameId = window.requestAnimationFrame(() => {
      fit();

      window.setTimeout(() => {
        fit();
      }, 120);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [fitViewNonce, isCompactViewport, nodes.length, nodesInitialized, reactFlow]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<ReactFlowNodeData>>[]) => {
      setInteractiveNodes((currentNodes) => applyNodeChanges(changes, [...currentNodes]));
    },
    []
  );

  const animateNodeSettle = useCallback(
    (
      nodeId: string,
      from: { readonly x: number; readonly y: number },
      to: { readonly x: number; readonly y: number }
    ) => {
      if (settleAnimationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(settleAnimationFrameRef.current);
      }

      const durationMs = 220;
      const startTime = window.performance.now();

      const step = (timestamp: number): void => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const nextPosition = {
          x: Math.round(from.x + (to.x - from.x) * easedProgress),
          y: Math.round(from.y + (to.y - from.y) * easedProgress),
        };

        setInteractiveNodes((currentNodes) =>
          currentNodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  position: nextPosition,
                }
              : node
          )
        );

        if (progress < 1) {
          settleAnimationFrameRef.current = window.requestAnimationFrame(step);
          return;
        }

        settleAnimationFrameRef.current = undefined;
        onMoveNodeCommit?.(nodeId, to);
      };

      settleAnimationFrameRef.current = window.requestAnimationFrame(step);
    },
    [onMoveNodeCommit]
  );

  const onNodeDragStop = useCallback<NodeMouseHandler<Node<ReactFlowNodeData>>>(
    (_event, node) => {
      const releasedPosition = {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      };
      const settledPosition =
        onResolveNodePlacement?.(node.id, releasedPosition) ?? releasedPosition;

      if (
        settledPosition.x === releasedPosition.x &&
        settledPosition.y === releasedPosition.y
      ) {
        onMoveNodeCommit?.(node.id, releasedPosition);
        return;
      }

      animateNodeSettle(node.id, releasedPosition, settledPosition);
    },
    [animateNodeSettle, onMoveNodeCommit, onResolveNodePlacement]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setInteractiveEdges((currentEdges) => applyEdgeChanges(changes, [...currentEdges]));
    },
    []
  );

  const onConnect = useCallback<OnConnect>(
    (connection: Connection) => {
      const optimisticEdge = createOptimisticEdgeFromConnection(connection);
      if (!optimisticEdge) {
        return;
      }

      setInteractiveEdges((currentEdges) => {
        const duplicateEdge = currentEdges.find(
          (edge) =>
            edge.source === optimisticEdge.source &&
            edge.sourceHandle === optimisticEdge.sourceHandle &&
            edge.target === optimisticEdge.target &&
            edge.targetHandle === optimisticEdge.targetHandle
        );

        if (duplicateEdge) {
          return currentEdges;
        }

        return [...currentEdges, optimisticEdge];
      });

      onConnectNodes?.({
        sourceNodeId: optimisticEdge.source,
        sourcePortId: optimisticEdge.sourceHandle ?? "",
        targetNodeId: optimisticEdge.target,
        targetPortId: optimisticEdge.targetHandle ?? "",
      });
    },
    [onConnectNodes]
  );

  const onNodeClick = useCallback<NodeMouseHandler<Node<ReactFlowNodeData>>>(
    (_event, node) => {
      onSelectNode?.(node.id);
    },
    [onSelectNode]
  );

  const onEdgeClick = useCallback<EdgeMouseHandler<Edge>>(
    (_event, edge) => {
      const connectionId =
        typeof edge.data?.connectionId === "string"
          ? edge.data.connectionId
          : edge.id;

      onSelectConnection?.(connectionId);
    },
    [onSelectConnection]
  );

  return (
    <div className="ui-rf-canvas">
      <ReactFlow<Node<ReactFlowNodeData>, Edge>
        className="ui-rf-root"
        style={{ width: "100%", height: "100%" }}
        nodes={interactiveNodes as Node<ReactFlowNodeData>[]}
        edges={interactiveEdges as Edge[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => onClearSelection?.()}
        fitView
        fitViewOptions={{
          padding: isCompactViewport ? 0.3 : 0.18,
          includeHiddenNodes: true,
          minZoom: 0.1,
          maxZoom: 1.5,
        }}
        minZoom={0.1}
        maxZoom={2}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll={!isCompactViewport}
        zoomOnPinch
        zoomOnDoubleClick={!isCompactViewport}
        snapToGrid
        snapGrid={[8, 8]}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
          zIndex: 1,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: "rgba(120, 187, 255, 0.98)",
          },
          style: {
            stroke: "rgba(120, 187, 255, 0.98)",
            strokeWidth: 3,
          },
        }}
        elevateEdgesOnSelect
      >
        <Background gap={24} size={1} />
        {!isCompactViewport ? <MiniMap pannable zoomable /> : null}
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function ReactFlowCanvas(
  props: ReactFlowCanvasProps
): JSX.Element {
  return (
    <ReactFlowProvider>
      <InnerReactFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
