import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type EdgeMouseHandler,
  type Edge,
  type Node,
  type NodeProps,
  type NodeMouseHandler,
  type OnConnect,
} from "@xyflow/react";
import {
  WorkflowCanvasBranchKeys,
  WorkflowCanvasGraphEdgeKinds,
  WorkflowCanvasGraphNodeKinds,
  WorkflowCanvasSectionIds,
  buildWorkflowCanvasBranchSourceHandleId,
  type WorkflowCanvasGraphEdgeKind,
  type WorkflowCanvasGraphEdgeViewModel,
  type WorkflowCanvasGraphNodeViewModel,
  type WorkflowCanvasGraphViewModel,
} from "../../../studio-shell/workflow/WorkflowStudioCanvasViewModel";

interface WorkflowStudioCanvasReactFlowProps {
  readonly graph: WorkflowCanvasGraphViewModel;
  readonly selectedNodeId?: string;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onClearSelection?: () => void;
  readonly renderNodeEditor?: (node: WorkflowCanvasGraphNodeViewModel) => JSX.Element | null;
  readonly onRemoveNode?: (node: WorkflowCanvasGraphNodeViewModel) => void;
  readonly onStepNodeDragStop?: (nodeId: string, position: { readonly x: number; readonly y: number }) => void;
  readonly onCreateConnection?: (connection: Connection) => void;
  readonly onReconnectConnection?: (edgeId: string, connection: Connection) => void;
  readonly onRemoveConnection?: (edgeId: string) => void;
}

interface WorkflowStudioCanvasGraphNodeData {
  readonly graphNode: WorkflowCanvasGraphNodeViewModel;
  readonly selectedNodeId?: string;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly renderNodeEditor?: (node: WorkflowCanvasGraphNodeViewModel) => JSX.Element | null;
  readonly onRemoveNode?: (node: WorkflowCanvasGraphNodeViewModel) => void;
}

type WorkflowStudioCanvasReactFlowEdge = Edge<{
  readonly editable: boolean;
  readonly kind: WorkflowCanvasGraphEdgeKind;
  readonly branchKey?: typeof WorkflowCanvasBranchKeys[keyof typeof WorkflowCanvasBranchKeys];
}>;

function WorkflowSectionGraphNode({
  data,
}: NodeProps<Node<WorkflowStudioCanvasGraphNodeData>>): JSX.Element {
  const issueCount = data.graphNode.issueCount;
  return (
    <article
      className="ui-workflow-canvas-node ui-workflow-canvas-node--section ui-card ui-card--padded ui-stack ui-stack--2xs"
      data-testid={`workflow-canvas-section-${data.graphNode.sectionId}`}
    >
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>{data.graphNode.title}</strong>
        <span className="ui-text-small ui-text-secondary">{data.graphNode.detailLines[0]}</span>
      </div>
      <p className="ui-text-muted">{data.graphNode.subtitle}</p>
      {issueCount > 0 ? (
        <p className="ui-text-small ui-text-danger">{issueCount} validation issue(s)</p>
      ) : null}
    </article>
  );
}

function WorkflowItemGraphNode({
  data,
}: NodeProps<Node<WorkflowStudioCanvasGraphNodeData>>): JSX.Element {
  const issueCount = data.graphNode.issueCount;
  const selected = data.selectedNodeId === data.graphNode.id;
  return (
    <article
      className={[
        "ui-workflow-canvas-node",
        "ui-workflow-canvas-node--item",
        "ui-card",
        "ui-card--padded",
        "ui-stack",
        "ui-stack--2xs",
        selected ? "ui-workflow-canvas-node--selected" : "",
        issueCount > 0 ? "ui-workflow-canvas-node--invalid" : "",
        data.graphNode.stepType === "if-then" ? "ui-workflow-canvas-node--branching" : "",
      ].filter(Boolean).join(" ")}
      data-testid={`workflow-canvas-node-${data.graphNode.sectionId}-${data.graphNode.entityId ?? data.graphNode.id}`}
    >
      <div className="ui-row ui-row--between ui-row--wrap">
        <button
          type="button"
          className={`ui-button ui-button--sm ${selected ? "ui-button--primary" : "ui-button--ghost"}`}
          data-testid={`workflow-canvas-node-select-${data.graphNode.sectionId}-${data.graphNode.entityId ?? data.graphNode.id}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data.onSelectNode?.(data.graphNode.id);
          }}
        >
          {data.graphNode.title}
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          data-testid={`workflow-canvas-node-remove-${data.graphNode.sectionId}-${data.graphNode.entityId ?? data.graphNode.id}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data.onRemoveNode?.(data.graphNode);
          }}
        >
          Remove
        </button>
      </div>
      <p className="ui-text-small ui-text-secondary">{data.graphNode.subtitle}</p>
      {data.renderNodeEditor ? (
        <div className="ui-workflow-canvas-node__editor ui-stack ui-stack--2xs">
          {data.renderNodeEditor(data.graphNode)}
        </div>
      ) : null}
      {data.graphNode.detailLines.length > 0 ? (
        <ul className="ui-stack ui-stack--2xs">
          {data.graphNode.detailLines.slice(0, 2).map((line, index) => (
            <li key={`${data.graphNode.id}-detail-${index}`} className="ui-text-small ui-text-muted">{line}</li>
          ))}
        </ul>
      ) : null}
      {issueCount > 0 ? <p className="ui-text-small ui-text-danger">{issueCount} issue(s)</p> : null}
      {data.graphNode.sectionId === WorkflowCanvasSectionIds.steps ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="ui-workflow-canvas-node__handle"
            id={`target:${data.graphNode.id}`}
          />
          <Handle
            type="source"
            position={Position.Right}
            className="ui-workflow-canvas-node__handle"
            id={`source:${data.graphNode.id}`}
          />
          {data.graphNode.stepType === "if-then" ? (
            <>
              <Handle
                type="source"
                position={Position.Right}
                className="ui-workflow-canvas-node__handle ui-workflow-canvas-node__handle--branch-then"
                id={buildWorkflowCanvasBranchSourceHandleId(data.graphNode.id, WorkflowCanvasBranchKeys.then)}
                style={{ top: "38%" }}
              />
              <Handle
                type="source"
                position={Position.Right}
                className="ui-workflow-canvas-node__handle ui-workflow-canvas-node__handle--branch-else"
                id={buildWorkflowCanvasBranchSourceHandleId(data.graphNode.id, WorkflowCanvasBranchKeys.else)}
                style={{ top: "62%" }}
              />
            </>
          ) : null}
        </>
      ) : null}
      {data.graphNode.sectionId === WorkflowCanvasSectionIds.outputs ? (
        <Handle
          type="target"
          position={Position.Left}
          className="ui-workflow-canvas-node__handle"
          id={`target:${data.graphNode.id}`}
        />
      ) : null}
    </article>
  );
}

function mapGraphNodeToReactFlowNode(
  node: WorkflowCanvasGraphNodeViewModel,
): Node<WorkflowStudioCanvasGraphNodeData> {
  return {
    id: node.id,
    type: node.kind === WorkflowCanvasGraphNodeKinds.section
      ? "workflowSection"
      : "workflowItem",
    position: {
      x: node.position.x,
      y: node.position.y,
    },
    draggable: node.kind === WorkflowCanvasGraphNodeKinds.item && node.sectionId === WorkflowCanvasSectionIds.steps,
    selectable: true,
    connectable: node.kind === WorkflowCanvasGraphNodeKinds.item && (
      node.sectionId === WorkflowCanvasSectionIds.steps || node.sectionId === WorkflowCanvasSectionIds.outputs
    ),
    style: {
      width: 260,
      height: node.height,
    },
    data: {
      graphNode: node,
      selectedNodeId: undefined,
      onSelectNode: undefined,
      renderNodeEditor: undefined,
      onRemoveNode: undefined,
    },
  };
}

function mapEdgeKindLabel(kind: WorkflowCanvasGraphEdgeKind): string {
  if (kind === WorkflowCanvasGraphEdgeKinds.sectionFlow) {
    return "flow";
  }
  if (kind === WorkflowCanvasGraphEdgeKinds.sectionEntry) {
    return "entry";
  }
  if (kind === WorkflowCanvasGraphEdgeKinds.stepDependency) {
    return "depends-on";
  }
  if (kind === WorkflowCanvasGraphEdgeKinds.outputSource) {
    return "output-source";
  }
  if (kind === WorkflowCanvasGraphEdgeKinds.stepBranch) {
    return "branch";
  }
  return "sequence";
}

function mapGraphEdgeToReactFlowEdge(
  edge: WorkflowCanvasGraphEdgeViewModel,
): WorkflowStudioCanvasReactFlowEdge {
  const isEditableEdge = edge.editable;
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandleId,
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
    },
    label: edge.label ?? mapEdgeKindLabel(edge.kind),
    className: edge.kind === WorkflowCanvasGraphEdgeKinds.stepBranch
      ? `ui-workflow-canvas-edge ui-workflow-canvas-edge--branch ui-workflow-canvas-edge--branch-${edge.branchKey ?? "then"}`
      : "ui-workflow-canvas-edge",
    deletable: isEditableEdge,
    reconnectable: isEditableEdge,
    selectable: isEditableEdge,
    animated: edge.kind === WorkflowCanvasGraphEdgeKinds.sectionFlow || edge.kind === WorkflowCanvasGraphEdgeKinds.outputSource,
    data: Object.freeze({
      editable: isEditableEdge,
      kind: edge.kind,
      branchKey: edge.branchKey,
    }),
    style: edge.kind === WorkflowCanvasGraphEdgeKinds.stepDependency
      ? Object.freeze({
        strokeDasharray: "7 5",
      })
      : edge.kind === WorkflowCanvasGraphEdgeKinds.stepBranch
        ? Object.freeze({
          strokeWidth: 2.5,
        })
      : undefined,
  };
}

const nodeTypes = {
  workflowSection: WorkflowSectionGraphNode,
  workflowItem: WorkflowItemGraphNode,
};

export default function WorkflowStudioCanvasReactFlow({
  graph,
  selectedNodeId,
  onSelectNode,
  onClearSelection,
  renderNodeEditor,
  onRemoveNode,
  onStepNodeDragStop,
  onCreateConnection,
  onReconnectConnection,
  onRemoveConnection,
}: WorkflowStudioCanvasReactFlowProps): JSX.Element {
  const nodes = useMemo(
    () => graph.nodes.map((node) => {
      const mapped = mapGraphNodeToReactFlowNode(node);
      return {
        ...mapped,
        data: {
          ...mapped.data,
          selectedNodeId,
          onSelectNode,
          renderNodeEditor,
          onRemoveNode,
        },
      };
    }),
    [graph.nodes, onRemoveNode, onSelectNode, renderNodeEditor, selectedNodeId],
  );

  const edges = useMemo(
    () => graph.edges.map((edge) => mapGraphEdgeToReactFlowEdge(edge)),
    [graph.edges],
  );

  const handleNodeClick = useMemo<NodeMouseHandler<Node<WorkflowStudioCanvasGraphNodeData>>>(
    () => (_event, node) => {
      onSelectNode?.(node.id);
    },
    [onSelectNode],
  );

  const handleEdgeClick = useMemo<EdgeMouseHandler<WorkflowStudioCanvasReactFlowEdge>>(
    () => () => {
      onClearSelection?.();
    },
    [onClearSelection],
  );

  const handleNodeDragStop = useMemo<NodeMouseHandler<Node<WorkflowStudioCanvasGraphNodeData>>>(
    () => (_event, node) => {
      onStepNodeDragStop?.(node.id, {
        x: node.position.x,
        y: node.position.y,
      });
    },
    [onStepNodeDragStop],
  );

  const handleConnect = useMemo<OnConnect>(
    () => (connection) => {
      onCreateConnection?.(connection);
    },
    [onCreateConnection],
  );

  const handleReconnect = useMemo(
    () => (edge: WorkflowStudioCanvasReactFlowEdge, connection: Connection) => {
      onReconnectConnection?.(edge.id, connection);
    },
    [onReconnectConnection],
  );

  const handleEdgeDoubleClick = useMemo<EdgeMouseHandler<WorkflowStudioCanvasReactFlowEdge>>(
    () => (_event, edge) => {
      if (edge.data?.editable !== true) {
        return;
      }
      onRemoveConnection?.(edge.id);
    },
    [onRemoveConnection],
  );

  return (
    <div className="ui-workflow-studio-canvas__surface ui-canvas-surface" data-testid="workflow-studio-canvas-reactflow">
      <ReactFlow<Node<WorkflowStudioCanvasGraphNodeData>, WorkflowStudioCanvasReactFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1.2 }}
        minZoom={0.35}
        maxZoom={1.8}
        panOnScroll={false}
        zoomOnPinch
        zoomOnScroll
        className="ui-rf-canvas ui-workflow-studio-canvas__reactflow"
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={onClearSelection}
        onEdgeClick={handleEdgeClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onEdgesDelete={(edges) => {
          for (const edge of edges) {
            onRemoveConnection?.(edge.id);
          }
        }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
