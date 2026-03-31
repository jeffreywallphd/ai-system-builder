import { z } from "zod";
import type {
  CanonicalDataShapeKind,
  CanonicalRecordValue,
} from "./CanonicalDataShapes";
import type { PipelineNodeInspectionMetadata } from "./PipelineInspectionDomain";
import { PipelineNodeInspectionMetadataSchema } from "./PipelineInspectionDomain";
import type {
  PipelineStageCategory,
  PipelineStageConfig,
  PipelineStageId,
  PipelineStageMetadata,
} from "./PipelineStageDomain";

export const PipelineGraphNodeKinds = Object.freeze({
  stage: "stage",
  asset: "asset",
} as const);

export type PipelineGraphNodeKind = typeof PipelineGraphNodeKinds[keyof typeof PipelineGraphNodeKinds];

export const PipelineGraphEdgeKinds = Object.freeze({
  stageToStage: "stage-to-stage",
  stageToAsset: "stage-to-asset",
  assetToAsset: "asset-to-asset",
  assetToStage: "asset-to-stage",
} as const);

export type PipelineGraphEdgeKind = typeof PipelineGraphEdgeKinds[keyof typeof PipelineGraphEdgeKinds];

export interface PipelineGraphStageNodeData {
  readonly stageId: PipelineStageId;
  readonly label: string;
  readonly description: string;
  readonly category: PipelineStageCategory;
  readonly stageOrder: number;
  readonly isOptional: boolean;
  readonly enabled: boolean;
  readonly supportsPreview: boolean;
  readonly inspectable: boolean;
  readonly config: PipelineStageConfig;
  readonly metadata: PipelineStageMetadata;
  readonly inspection?: PipelineNodeInspectionMetadata;
}

export interface PipelineGraphAssetNodeData {
  readonly stageId: PipelineStageId;
  readonly groupId: string;
  readonly assetId: string;
  readonly assetVersion?: string;
  readonly role: string;
  readonly stageOrder: number;
  readonly executionOrder: number;
  readonly assetOrder: number;
  readonly inspectable: boolean;
  readonly config: Readonly<Record<string, CanonicalRecordValue>>;
  readonly inspection?: PipelineNodeInspectionMetadata;
}

export interface PipelineGraphStageNode {
  readonly id: string;
  readonly kind: "stage";
  readonly data: PipelineGraphStageNodeData;
}

export interface PipelineGraphAssetNode {
  readonly id: string;
  readonly kind: "asset";
  readonly data: PipelineGraphAssetNodeData;
}

export type PipelineGraphNode = PipelineGraphStageNode | PipelineGraphAssetNode;

export interface PipelineGraphEdge {
  readonly id: string;
  readonly kind: PipelineGraphEdgeKind;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceStageId: PipelineStageId;
  readonly targetStageId: PipelineStageId;
  readonly compatibilityTypes: ReadonlyArray<CanonicalDataShapeKind>;
}

export interface PipelineGraph {
  readonly nodes: ReadonlyArray<PipelineGraphNode>;
  readonly edges: ReadonlyArray<PipelineGraphEdge>;
}

const StageNodeDataSchema = z.object({
  stageId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().min(1),
  stageOrder: z.number().int().min(1),
  isOptional: z.boolean(),
  enabled: z.boolean(),
  supportsPreview: z.boolean(),
  inspectable: z.boolean(),
  config: z.object({
    mode: z.string().trim().min(1),
    declaredInputType: z.string().trim().min(1).optional(),
    expectedOutputType: z.string().trim().min(1).optional(),
    options: z.record(z.any()),
  }),
  metadata: z.object({
    tags: z.array(z.string().trim().min(1)),
    inspectable: z.boolean(),
    previewReference: z.string().trim().min(1).optional(),
    sourceReference: z.string().trim().min(1).optional(),
    attributes: z.record(z.any()).optional(),
  }),
  inspection: PipelineNodeInspectionMetadataSchema.optional(),
});

const AssetNodeDataSchema = z.object({
  stageId: z.string().trim().min(1),
  groupId: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
  assetVersion: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1),
  stageOrder: z.number().int().min(1),
  executionOrder: z.number().int().min(1),
  assetOrder: z.number().int().min(1),
  inspectable: z.boolean(),
  config: z.record(z.any()),
  inspection: PipelineNodeInspectionMetadataSchema.optional(),
});

export const PipelineGraphNodeSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().trim().min(1),
    kind: z.literal(PipelineGraphNodeKinds.stage),
    data: StageNodeDataSchema,
  }),
  z.object({
    id: z.string().trim().min(1),
    kind: z.literal(PipelineGraphNodeKinds.asset),
    data: AssetNodeDataSchema,
  }),
]);

export const PipelineGraphEdgeSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.nativeEnum(PipelineGraphEdgeKinds),
  sourceNodeId: z.string().trim().min(1),
  targetNodeId: z.string().trim().min(1),
  sourceStageId: z.string().trim().min(1),
  targetStageId: z.string().trim().min(1),
  compatibilityTypes: z.array(z.string().trim().min(1)),
});

export const PipelineGraphSchema = z.object({
  nodes: z.array(PipelineGraphNodeSchema),
  edges: z.array(PipelineGraphEdgeSchema),
});

function validateEdgeEndpoints(
  nodesById: ReadonlyMap<string, PipelineGraphNode>,
  edge: PipelineGraphEdge,
): void {
  const source = nodesById.get(edge.sourceNodeId);
  const target = nodesById.get(edge.targetNodeId);

  if (!source) {
    throw new Error(`Pipeline graph edge '${edge.id}' has unknown source node '${edge.sourceNodeId}'.`);
  }
  if (!target) {
    throw new Error(`Pipeline graph edge '${edge.id}' has unknown target node '${edge.targetNodeId}'.`);
  }

  if (source.data.stageId !== edge.sourceStageId) {
    throw new Error(`Pipeline graph edge '${edge.id}' source stage id is inconsistent with source node.`);
  }
  if (target.data.stageId !== edge.targetStageId) {
    throw new Error(`Pipeline graph edge '${edge.id}' target stage id is inconsistent with target node.`);
  }

  switch (edge.kind) {
    case PipelineGraphEdgeKinds.stageToStage:
      if (source.kind !== PipelineGraphNodeKinds.stage || target.kind !== PipelineGraphNodeKinds.stage) {
        throw new Error(`Pipeline graph edge '${edge.id}' must connect stage nodes for kind '${edge.kind}'.`);
      }
      break;
    case PipelineGraphEdgeKinds.stageToAsset:
      if (source.kind !== PipelineGraphNodeKinds.stage || target.kind !== PipelineGraphNodeKinds.asset) {
        throw new Error(`Pipeline graph edge '${edge.id}' must connect stage->asset for kind '${edge.kind}'.`);
      }
      break;
    case PipelineGraphEdgeKinds.assetToAsset:
      if (source.kind !== PipelineGraphNodeKinds.asset || target.kind !== PipelineGraphNodeKinds.asset) {
        throw new Error(`Pipeline graph edge '${edge.id}' must connect asset->asset for kind '${edge.kind}'.`);
      }
      break;
    case PipelineGraphEdgeKinds.assetToStage:
      if (source.kind !== PipelineGraphNodeKinds.asset || target.kind !== PipelineGraphNodeKinds.stage) {
        throw new Error(`Pipeline graph edge '${edge.id}' must connect asset->stage for kind '${edge.kind}'.`);
      }
      break;
    default:
      throw new Error(`Pipeline graph edge '${edge.id}' has unsupported edge kind '${edge.kind}'.`);
  }
}

export function validatePipelineGraph(input: PipelineGraph): PipelineGraph {
  const parsed = PipelineGraphSchema.parse(input) as PipelineGraph;

  const nodesById = new Map<string, PipelineGraphNode>();
  for (const node of parsed.nodes) {
    if (nodesById.has(node.id)) {
      throw new Error(`Pipeline graph contains duplicate node id '${node.id}'.`);
    }
    nodesById.set(node.id, node);
  }

  const edgesById = new Set<string>();
  for (const edge of parsed.edges) {
    if (edgesById.has(edge.id)) {
      throw new Error(`Pipeline graph contains duplicate edge id '${edge.id}'.`);
    }
    edgesById.add(edge.id);
    validateEdgeEndpoints(nodesById, edge);
  }

  for (const node of parsed.nodes) {
    if (node.kind !== PipelineGraphNodeKinds.asset) {
      continue;
    }
    const stageNodeId = `stage:${node.data.stageId}`;
    if (!nodesById.has(stageNodeId)) {
      throw new Error(
        `Pipeline graph asset node '${node.id}' is missing its stage node '${stageNodeId}'.`,
      );
    }
  }

  return Object.freeze({
    nodes: Object.freeze(parsed.nodes.map((node) => Object.freeze(node))),
    edges: Object.freeze(parsed.edges.map((edge) => Object.freeze(edge))),
  });
}

export function serializePipelineGraph(graph: PipelineGraph): string {
  const validated = validatePipelineGraph(graph);
  return JSON.stringify(validated);
}

export function deserializePipelineGraph(serialized: string): PipelineGraph {
  return validatePipelineGraph(JSON.parse(serialized) as PipelineGraph);
}

export interface PipelineGraphInspectionSummary {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly stageNodeCount: number;
  readonly assetNodeCount: number;
  readonly stageIds: ReadonlyArray<PipelineStageId>;
}

export function inspectPipelineGraph(graph: PipelineGraph): PipelineGraphInspectionSummary {
  const validated = validatePipelineGraph(graph);
  const stageIds = validated.nodes
    .filter((node): node is PipelineGraphStageNode => node.kind === PipelineGraphNodeKinds.stage)
    .sort((left, right) => left.data.stageOrder - right.data.stageOrder)
    .map((node) => node.data.stageId);

  const stageNodeCount = stageIds.length;
  const assetNodeCount = validated.nodes.length - stageNodeCount;

  return Object.freeze({
    nodeCount: validated.nodes.length,
    edgeCount: validated.edges.length,
    stageNodeCount,
    assetNodeCount,
    stageIds: Object.freeze(stageIds),
  });
}
