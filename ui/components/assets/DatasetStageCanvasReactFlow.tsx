import { useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeMouseHandler,
} from "@xyflow/react";
import type {
  StageCanvasAssetNodeViewModel,
  StageCanvasGraphModel,
  StageCanvasGraphEdgeViewModel,
  StageCanvasGroupViewModel,
} from "../../../application/dataset-studio/StageCanvasGraphProjectionService";

interface DatasetStageCanvasReactFlowProps {
  readonly graph: StageCanvasGraphModel;
  readonly selectedStageId?: string;
  readonly onSelectStage?: (stageId: string) => void;
}

interface DatasetStageCanvasNodeData {
  readonly node: StageCanvasAssetNodeViewModel;
  readonly group: StageCanvasGroupViewModel;
  readonly selectedStageId?: string;
  readonly onSelectStage?: (stageId: string) => void;
}

function DatasetStageCanvasNode({
  data,
}: NodeProps<Node<DatasetStageCanvasNodeData>>): JSX.Element {
  const selected = data.selectedStageId === data.group.stageId;
  return (
    <article
      className={[
        "ui-dataset-stage-canvas-node",
        "ui-card",
        "ui-card--padded",
        selected ? "ui-dataset-stage-canvas-node--selected" : "",
      ].filter(Boolean).join(" ")}
      data-testid={`dataset-stage-canvas-node-${data.node.id}`}
    >
      <div className="ui-row ui-row--between ui-row--wrap">
        <button
          type="button"
          className={`ui-button ui-button--sm ${selected ? "ui-button--primary" : "ui-button--ghost"}`}
          onClick={() => data.onSelectStage?.(data.group.stageId)}
        >
          {data.group.title}
        </button>
        <span className="ui-badge ui-badge--neutral">{data.group.status}</span>
      </div>
      <p className="ui-text-small ui-text-secondary">{data.group.description}</p>
      <div className="ui-stack ui-stack--2xs">
        <span className="ui-text-small"><strong>Asset</strong>: {data.node.assetId}</span>
        <span className="ui-text-small ui-text-secondary">{data.node.subtitle}</span>
      </div>
    </article>
  );
}

function toPosition(index: number, groupOrder: number): { readonly x: number; readonly y: number } {
  return Object.freeze({
    x: (groupOrder - 1) * 320,
    y: index * 190,
  });
}

function mapNode(
  node: StageCanvasAssetNodeViewModel,
  group: StageCanvasGroupViewModel,
  selectedStageId: string | undefined,
  onSelectStage: ((stageId: string) => void) | undefined,
  indexInGroup: number,
): Node<DatasetStageCanvasNodeData> {
  return Object.freeze({
    id: node.id,
    type: "datasetStageNode",
    position: toPosition(indexInGroup, group.metadata.stageOrder),
    draggable: false,
    selectable: true,
    connectable: false,
    style: {
      width: 280,
    },
    data: Object.freeze({
      node,
      group,
      selectedStageId,
      onSelectStage,
    }),
  });
}

function mapEdge(edge: StageCanvasGraphEdgeViewModel): Edge {
  return Object.freeze({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
    },
    label: edge.kind === "conditional-stage-flow" ? "conditional" : "flow",
    animated: edge.kind === "conditional-stage-flow",
    className: edge.kind === "conditional-stage-flow"
      ? "ui-dataset-stage-canvas-edge ui-dataset-stage-canvas-edge--conditional"
      : "ui-dataset-stage-canvas-edge",
  });
}

const nodeTypes = {
  datasetStageNode: DatasetStageCanvasNode,
};

export default function DatasetStageCanvasReactFlow({
  graph,
  selectedStageId,
  onSelectStage,
}: DatasetStageCanvasReactFlowProps): JSX.Element {
  const groupById = useMemo(
    () => new Map(graph.groups.map((group) => [group.id, group])),
    [graph.groups],
  );

  const nodes = useMemo(
    () => graph.nodes.map((node) => {
      const group = groupById.get(node.groupId);
      if (!group) {
        return undefined;
      }
      const indexInGroup = group.nodeIds.findIndex((id) => id === node.id);
      return mapNode(node, group, selectedStageId, onSelectStage, indexInGroup < 0 ? 0 : indexInGroup);
    }).filter((node): node is Node<DatasetStageCanvasNodeData> => Boolean(node)),
    [graph.nodes, groupById, onSelectStage, selectedStageId],
  );

  const edges = useMemo(
    () => graph.edges.map((edge) => mapEdge(edge)),
    [graph.edges],
  );

  const handleNodeClick = useMemo<NodeMouseHandler<Node<DatasetStageCanvasNodeData>>>(
    () => (_event, node) => onSelectStage?.(node.data.group.stageId),
    [onSelectStage],
  );

  return (
    <div className="ui-dataset-stage-canvas__surface ui-canvas-surface" data-testid="dataset-stage-canvas-reactflow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.24, maxZoom: 1.2 }}
        minZoom={0.35}
        maxZoom={1.8}
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        className="ui-rf-canvas ui-dataset-stage-canvas__reactflow"
        onNodeClick={handleNodeClick}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
