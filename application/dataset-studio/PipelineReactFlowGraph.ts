import type { Edge, Node } from "@xyflow/react";
import {
  PipelineGraphEdgeKinds,
  PipelineGraphNodeKinds,
  validatePipelineGraph,
  type PipelineGraphEdgeKind,
  type PipelineGraph,
  type PipelineGraphEdge,
  type PipelineGraphNode,
} from "../../domain/dataset-studio/PipelineGraphDomain";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";

export interface StageNodeData {
  readonly nodeKind: "stage";
  readonly stageId: string;
  readonly label: string;
  readonly description: string;
  readonly category: string;
  readonly config: Readonly<Record<string, CanonicalRecordValue>>;
  readonly previewCapable: boolean;
  readonly inspectable: boolean;
  readonly inspectionHook: {
    readonly stageId: string;
    readonly sourceReference?: string;
    readonly previewReference?: string;
  };
}

export interface AssetNodeData {
  readonly nodeKind: "asset";
  readonly stageId: string;
  readonly assetId: string;
  readonly assetVersion?: string;
  readonly role: string;
  readonly label: string;
  readonly config: Readonly<Record<string, CanonicalRecordValue>>;
  readonly previewCapable: boolean;
  readonly inspectable: boolean;
  readonly inspectionHook: {
    readonly stageId: string;
    readonly assetId: string;
  };
}

export type PipelineReactFlowNode =
  | Node<StageNodeData, "stage">
  | Node<AssetNodeData, "asset">;

export interface PipelineReactFlowEdgeData {
  readonly edgeKind: PipelineGraphEdgeKind;
  readonly sourceStageId: string;
  readonly targetStageId: string;
  readonly compatibilityTypes: ReadonlyArray<string>;
}

export type PipelineReactFlowEdge =
  | Edge<PipelineReactFlowEdgeData, "pipeline-default">
  | Edge<PipelineReactFlowEdgeData, "pipeline-bridge">;

export interface PipelineReactFlowGraph {
  readonly nodes: ReadonlyArray<PipelineReactFlowNode>;
  readonly edges: ReadonlyArray<PipelineReactFlowEdge>;
}

export interface PipelineReactFlowLayoutOptions {
  readonly stageGapX: number;
  readonly stageHeaderY: number;
  readonly assetOffsetX: number;
  readonly assetStartY: number;
  readonly assetGapY: number;
}

const DefaultLayoutOptions: PipelineReactFlowLayoutOptions = Object.freeze({
  stageGapX: 380,
  stageHeaderY: 24,
  assetOffsetX: 190,
  assetStartY: 132,
  assetGapY: 160,
});

function stageOrder(node: PipelineGraphNode): number {
  return node.kind === PipelineGraphNodeKinds.stage
    ? node.data.stageOrder
    : node.data.stageOrder;
}

function toReactFlowNode(
  node: PipelineGraphNode,
  layout: PipelineReactFlowLayoutOptions,
): PipelineReactFlowNode {
  const stageIndex = stageOrder(node) - 1;

  if (node.kind === PipelineGraphNodeKinds.stage) {
    return Object.freeze({
      id: node.id,
      type: "stage",
      position: Object.freeze({
        x: stageIndex * layout.stageGapX,
        y: layout.stageHeaderY,
      }),
      data: Object.freeze({
        nodeKind: "stage",
        stageId: node.data.stageId,
        label: node.data.label,
        description: node.data.description,
        category: node.data.category,
        config: node.data.config.options,
        previewCapable: node.data.supportsPreview,
        inspectable: node.data.inspectable,
        inspectionHook: Object.freeze({
          stageId: node.data.stageId,
          sourceReference: node.data.metadata.sourceReference,
          previewReference: node.data.metadata.previewReference,
        }),
      }),
    });
  }

  return Object.freeze({
    id: node.id,
    type: "asset",
    position: Object.freeze({
      x: (stageIndex * layout.stageGapX) + layout.assetOffsetX,
      y: layout.assetStartY + ((node.data.assetOrder - 1) * layout.assetGapY),
    }),
    data: Object.freeze({
      nodeKind: "asset",
      stageId: node.data.stageId,
      assetId: node.data.assetId,
      assetVersion: node.data.assetVersion,
      role: node.data.role,
      label: node.data.role,
      config: node.data.config,
      previewCapable: node.data.inspectable,
      inspectable: node.data.inspectable,
      inspectionHook: Object.freeze({
        stageId: node.data.stageId,
        assetId: node.data.assetId,
      }),
    }),
  });
}

function toReactFlowEdge(edge: PipelineGraphEdge): PipelineReactFlowEdge {
  const edgeType = edge.kind === PipelineGraphEdgeKinds.assetToStage
    ? "pipeline-bridge"
    : "pipeline-default";

  return Object.freeze({
    id: edge.id,
    type: edgeType,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    data: Object.freeze({
      edgeKind: edge.kind,
      sourceStageId: edge.sourceStageId,
      targetStageId: edge.targetStageId,
      compatibilityTypes: edge.compatibilityTypes,
    }),
  }) as PipelineReactFlowEdge;
}

export function buildReactFlowGraph(
  pipelineGraph: PipelineGraph,
  options?: Partial<PipelineReactFlowLayoutOptions>,
): PipelineReactFlowGraph {
  const validated = validatePipelineGraph(pipelineGraph);
  const layout: PipelineReactFlowLayoutOptions = Object.freeze({
    ...DefaultLayoutOptions,
    ...options,
  });

  const sortedNodes = [...validated.nodes].sort((left, right) => {
    const leftOrder = stageOrder(left);
    const rightOrder = stageOrder(right);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    if (left.kind !== right.kind) {
      return left.kind === PipelineGraphNodeKinds.stage ? -1 : 1;
    }

    if (left.kind === PipelineGraphNodeKinds.asset && right.kind === PipelineGraphNodeKinds.asset) {
      return left.data.assetOrder - right.data.assetOrder;
    }

    return left.id.localeCompare(right.id);
  });

  const nodes = sortedNodes.map((node) => toReactFlowNode(node, layout));
  const edges = validated.edges.map((edge) => toReactFlowEdge(edge));

  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}
