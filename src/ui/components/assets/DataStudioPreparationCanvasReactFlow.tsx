import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import type { DataStudioCanvasProjection } from "@application/data-studio/DataStudioWizardCanvasProjectionService";

export interface DataStudioPreparationCanvasReactFlowProps {
  readonly projection: DataStudioCanvasProjection;
  readonly selectedNodeId?: string;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onClearSelection?: () => void;
}

function toFlowNodes(projection: DataStudioCanvasProjection): ReadonlyArray<Node> {
  const groupById = new Map(projection.graph.groups.map((group) => [group.id, group]));
  const nodeOrderByGroup = new Map<string, ReadonlyArray<string>>(
    projection.graph.groups.map((group) => [group.id, group.nodeIds]),
  );

  return Object.freeze(projection.graph.nodes.map((node) => {
    const group = node.groupId ? groupById.get(node.groupId) : undefined;
    const groupOrder = group?.order ?? 1;
    const groupNodeOrder = node.groupId
      ? (nodeOrderByGroup.get(node.groupId) ?? [])
      : [];
    const indexInGroup = Math.max(groupNodeOrder.findIndex((entry) => entry === node.id), 0);
    const stageStatus = typeof node.metadata?.stageStatus === "string"
      ? node.metadata.stageStatus
      : undefined;

    return Object.freeze({
      id: node.id,
      position: Object.freeze({
        x: (groupOrder - 1) * 340,
        y: indexInGroup * 140,
      }),
      data: Object.freeze({
        label: stageStatus
          ? `${node.label} (${stageStatus})`
          : node.label,
      }),
      type: "default",
      draggable: false,
      selectable: true,
    } satisfies Node);
  }));
}

function toFlowEdges(projection: DataStudioCanvasProjection): ReadonlyArray<Edge> {
  return Object.freeze(projection.graph.edges.map((edge) => Object.freeze({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label,
    type: "smoothstep",
    animated: edge.metadata?.isActiveTransition === true,
  } satisfies Edge)));
}

export default function DataStudioPreparationCanvasReactFlow(
  props: DataStudioPreparationCanvasReactFlowProps,
): JSX.Element {
  const nodes = useMemo(() => toFlowNodes(props.projection), [props.projection]);
  const edges = useMemo(() => toFlowEdges(props.projection), [props.projection]);
  const onNodeClick = useMemo<NodeMouseHandler>(() => ((_, node) => {
    props.onSelectNode?.(node.id);
  }), [props]);

  return (
    <section className="ui-workflow-studio-canvas__canvas-shell" data-testid="data-studio-canvas-react-flow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        onPaneClick={() => props.onClearSelection?.()}
      >
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
        <Background gap={20} />
      </ReactFlow>
    </section>
  );
}

