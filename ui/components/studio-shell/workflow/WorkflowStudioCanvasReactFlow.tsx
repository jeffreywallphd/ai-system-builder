import { useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type EdgeMouseHandler,
  type Edge,
  type Node,
  type NodeProps,
  type NodeMouseHandler,
} from "@xyflow/react";
import {
  WorkflowCanvasGraphEdgeKinds,
  WorkflowCanvasGraphNodeKinds,
  type WorkflowCanvasGraphEdgeKind,
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
}

interface WorkflowStudioCanvasGraphNodeData {
  readonly graphNode: WorkflowCanvasGraphNodeViewModel;
  readonly selectedNodeId?: string;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly renderNodeEditor?: (node: WorkflowCanvasGraphNodeViewModel) => JSX.Element | null;
  readonly onRemoveNode?: (node: WorkflowCanvasGraphNodeViewModel) => void;
}

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
      className={`ui-workflow-canvas-node ui-workflow-canvas-node--item ui-card ui-card--padded ui-stack ui-stack--2xs ${selected ? "ui-workflow-canvas-node--selected" : ""}`}
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
    draggable: false,
    selectable: true,
    connectable: false,
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
  return "sequence";
}

function mapGraphEdgeToReactFlowEdge(
  edge: { readonly id: string; readonly kind: WorkflowCanvasGraphEdgeKind; readonly sourceNodeId: string; readonly targetNodeId: string },
): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: "smoothstep",
    animated: edge.kind === WorkflowCanvasGraphEdgeKinds.sectionFlow,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
    },
    label: mapEdgeKindLabel(edge.kind),
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

  const handleEdgeClick = useMemo<EdgeMouseHandler<Edge>>(
    () => () => {
      onClearSelection?.();
    },
    [onClearSelection],
  );

  return (
    <div className="ui-workflow-studio-canvas__surface ui-canvas-surface" data-testid="workflow-studio-canvas-reactflow">
      <ReactFlow
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
        onPaneClick={onClearSelection}
        onEdgeClick={handleEdgeClick}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
