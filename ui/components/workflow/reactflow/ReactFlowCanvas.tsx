import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
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
import { EdgeAdapter } from "./EdgeAdapter";
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

function syncInteractiveEdges(
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
  onConnectNodes,
  onOpenNodeProperties,
  onNodePropertyChange,
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
      }),
    [
      isCompactViewport,
      nodeAdapter,
      nodes,
      onNodePropertyChange,
      onOpenNodeProperties,
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
        edge.id === selectedConnectionId
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
      for (const change of changes) {
        if (
          change.type === "position" &&
          change.position &&
          !change.dragging &&
          onMoveNodeCommit
        ) {
          onMoveNodeCommit(change.id, {
            x: change.position.x,
            y: change.position.y,
          });
        }
      }

      setInteractiveNodes((currentNodes) => applyNodeChanges(changes, [...currentNodes]));
    },
    [onMoveNodeCommit]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setInteractiveEdges((currentEdges) => applyEdgeChanges(changes, [...currentEdges]));
    },
    []
  );

  const onConnect = useCallback<OnConnect>(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.sourceHandle ||
        !connection.target ||
        !connection.targetHandle
      ) {
        return;
      }

      onConnectNodes?.({
        sourceNodeId: connection.source,
        sourcePortId: connection.sourceHandle,
        targetNodeId: connection.target,
        targetPortId: connection.targetHandle,
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
      onSelectConnection?.(edge.id);
    },
    [onSelectConnection]
  );

  return (
    <div className="ui-rf-canvas">
      <ReactFlow
        className="ui-rf-root"
        style={{ width: "100%", height: "100%" }}
        nodes={interactiveNodes as Node<ReactFlowNodeData>[]}
        edges={interactiveEdges as Edge[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
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
        }}
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
