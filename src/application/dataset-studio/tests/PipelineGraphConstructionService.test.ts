import { describe, expect, it } from "bun:test";
import {
  createPipelineStageInstance,
  PipelineStageConfigModes,
  PipelineStageIds,
  type PipelineStageDefinition,
  type PipelineStageInstance,
} from "@domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "@domain/dataset-studio/PipelineStageRegistry";
import {
  PipelineGraphEdgeKinds,
  deserializePipelineGraph,
  inspectPipelineGraph,
  serializePipelineGraph,
} from "@domain/dataset-studio/PipelineGraphDomain";
import { buildPipelineGraph } from "../PipelineGraphConstructionService";

function stageInstance(
  definition: PipelineStageDefinition,
  options?: {
    readonly enabled?: boolean;
    readonly config?: Readonly<Record<string, unknown>>;
  },
): PipelineStageInstance {
  return createPipelineStageInstance({
    definition,
    enabled: options?.enabled,
    config: {
      mode: PipelineStageConfigModes.simple,
      options: options?.config ?? Object.freeze({}),
    },
  });
}

describe("PipelineGraphConstructionService", () => {
  it("builds a deterministic, serializable stage/asset graph", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      stageInstance(registry.getDefinition(PipelineStageIds.SourceSelection)),
      stageInstance(registry.getDefinition(PipelineStageIds.UnifiedIngestion)),
      stageInstance(registry.getDefinition(PipelineStageIds.Normalization)),
      stageInstance(registry.getDefinition(PipelineStageIds.Cleaning)),
      stageInstance(registry.getDefinition(PipelineStageIds.Transformation)),
      stageInstance(registry.getDefinition(PipelineStageIds.StoragePrepared)),
    ]);

    const first = buildPipelineGraph({ stageInstances });
    const second = buildPipelineGraph({ stageInstances });

    expect(first).toEqual(second);

    const summary = inspectPipelineGraph(first);
    expect(summary.stageNodeCount).toBe(6);
    expect(summary.assetNodeCount).toBeGreaterThan(0);

    const serialized = serializePipelineGraph(first);
    const rehydrated = deserializePipelineGraph(serialized);
    expect(rehydrated).toEqual(first);

    expect(first.edges.some((edge) => edge.kind === PipelineGraphEdgeKinds.stageToAsset)).toBeTrue();
    expect(first.edges.some((edge) => edge.kind === PipelineGraphEdgeKinds.assetToAsset)).toBeTrue();
    expect(first.edges.some((edge) => edge.kind === PipelineGraphEdgeKinds.stageToStage)).toBeTrue();
    expect(first.edges.some((edge) => edge.kind === PipelineGraphEdgeKinds.assetToStage)).toBeTrue();
  });

  it("skips optional disabled stages without breaking graph connectivity", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      stageInstance(registry.getDefinition(PipelineStageIds.SourceSelection)),
      stageInstance(registry.getDefinition(PipelineStageIds.UnifiedIngestion)),
      stageInstance(registry.getDefinition(PipelineStageIds.Profiling), { enabled: false }),
      stageInstance(registry.getDefinition(PipelineStageIds.Normalization)),
      stageInstance(registry.getDefinition(PipelineStageIds.Cleaning)),
      stageInstance(registry.getDefinition(PipelineStageIds.Transformation)),
      stageInstance(registry.getDefinition(PipelineStageIds.StoragePrepared)),
    ]);

    const graph = buildPipelineGraph({ stageInstances });

    expect(graph.nodes.some((node) => node.id === "stage:Profiling")).toBeFalse();
    expect(graph.edges.some((edge) => edge.id.includes("stage:UnifiedIngestion->stage:Normalization"))).toBeTrue();
  });

  it("fails fast for incompatible stage adjacency", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      stageInstance(registry.getDefinition(PipelineStageIds.Aggregation)),
      stageInstance(registry.getDefinition(PipelineStageIds.Chunking)),
    ]);

    expect(() => buildPipelineGraph({ stageInstances })).toThrow(
      "no compatible output/input data shapes",
    );
  });

  it("blocks branching unless explicitly allowed", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      stageInstance(registry.getDefinition(PipelineStageIds.SourceSelection)),
      stageInstance(registry.getDefinition(PipelineStageIds.UnifiedIngestion)),
      stageInstance(registry.getDefinition(PipelineStageIds.Profiling)),
      stageInstance(registry.getDefinition(PipelineStageIds.Extraction)),
    ]);

    const transitions = Object.freeze([
      Object.freeze({ fromStageId: PipelineStageIds.SourceSelection, toStageId: PipelineStageIds.UnifiedIngestion }),
      Object.freeze({ fromStageId: PipelineStageIds.UnifiedIngestion, toStageId: PipelineStageIds.Profiling }),
      Object.freeze({ fromStageId: PipelineStageIds.UnifiedIngestion, toStageId: PipelineStageIds.Extraction }),
    ]);

    expect(() => buildPipelineGraph({ stageInstances, transitions })).toThrow(
      "must be explicitly allowed for branching",
    );

    const graph = buildPipelineGraph({
      stageInstances,
      transitions,
      explicitBranchingStageIds: Object.freeze([PipelineStageIds.UnifiedIngestion]),
    });

    const unifiedOutEdges = graph.edges.filter((edge) => edge.sourceStageId === PipelineStageIds.UnifiedIngestion);
    expect(unifiedOutEdges.length).toBeGreaterThan(2);
  });
});

