import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
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

  useEffect(() => {
    if (fitViewNonce === undefined) {
      return;
    }

    void reactFlow.fitView({
      padding: 0.18,
      duration: 250,
    });
  }, [fitViewNonce, reactFlow]);

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

      applyNodeChanges(changes, [...renderedNodes]);
    },
    [onMoveNodeCommit, renderedNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      applyEdgeChanges(changes, [...renderedEdges]);
    },
    [renderedEdges]
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
        nodes={renderedNodes as Node<ReactFlowNodeData>[]}
        edges={renderedEdges as Edge[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => onClearSelection?.()}
        fitView
        snapToGrid
        snapGrid={[8, 8]}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
        }}
      >
        <Background gap={24} size={1} />
        <MiniMap pannable zoomable />
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
