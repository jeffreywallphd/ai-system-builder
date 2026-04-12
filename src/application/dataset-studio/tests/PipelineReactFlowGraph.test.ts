import { describe, expect, it } from "bun:test";
import {
  createPipelineStageInstance,
  PipelineStageConfigModes,
  PipelineStageIds,
} from "@domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "@domain/dataset-studio/PipelineStageRegistry";
import { buildPipelineGraph } from "../PipelineGraphConstructionService";
import { buildReactFlowGraph } from "../PipelineReactFlowGraph";

describe("PipelineReactFlowGraph", () => {
  it("maps pipeline graph to typed React Flow nodes and edges with deterministic layout", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.SourceSelection),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.UnifiedIngestion),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Normalization),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
    ]);

    const pipelineGraph = buildPipelineGraph({ stageInstances });
    const mappedA = buildReactFlowGraph(pipelineGraph);
    const mappedB = buildReactFlowGraph(pipelineGraph);

    expect(mappedA).toEqual(mappedB);
    expect(mappedA.nodes.length).toBe(pipelineGraph.nodes.length);
    expect(mappedA.edges.length).toBe(pipelineGraph.edges.length);

    const stageNodes = mappedA.nodes.filter((node) => node.type === "stage");
    const assetNodes = mappedA.nodes.filter((node) => node.type === "asset");

    expect(stageNodes.length).toBe(3);
    expect(assetNodes.length).toBeGreaterThan(0);
    expect(stageNodes.every((node) => node.data.nodeKind === "stage")).toBeTrue();
    expect(assetNodes.every((node) => node.data.nodeKind === "asset")).toBeTrue();

    const sourceStage = stageNodes.find((node) => node.data.stageId === PipelineStageIds.SourceSelection);
    const ingestionStage = stageNodes.find((node) => node.data.stageId === PipelineStageIds.UnifiedIngestion);
    expect(sourceStage).toBeDefined();
    expect(ingestionStage).toBeDefined();
    expect((ingestionStage?.position.x ?? 0) > (sourceStage?.position.x ?? 0)).toBeTrue();

    const sourceAssets = assetNodes.filter((node) => node.data.stageId === PipelineStageIds.SourceSelection);
    expect(sourceAssets.length).toBeGreaterThan(0);
    expect(sourceAssets.every((node) => (node.position.x > (sourceStage?.position.x ?? 0)))).toBeTrue();

    expect(mappedA.edges.every((edge) => edge.source.length > 0 && edge.target.length > 0)).toBeTrue();
    expect(mappedA.edges.every((edge) => edge.data?.edgeKind !== undefined)).toBeTrue();
  });

  it("exposes annotation/feature specialization metadata for future UI-oriented nodes", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Transformation),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.FeatureEngineering),
        config: {
          mode: PipelineStageConfigModes.advanced,
          options: Object.freeze({
            featureStrategy: "structured",
            featureOperations: Object.freeze([]),
          }),
        },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Labeling),
        config: {
          mode: PipelineStageConfigModes.advanced,
          options: Object.freeze({
            labelingMode: "manual",
            annotationTarget: "record",
          }),
        },
      }),
    ]);

    const graph = buildPipelineGraph({ stageInstances });
    const reactFlow = buildReactFlowGraph(graph);
    const featureNode = reactFlow.nodes.find((node) => node.type === "stage" && node.data.stageId === PipelineStageIds.FeatureEngineering);
    const labelingNode = reactFlow.nodes.find((node) => node.type === "stage" && node.data.stageId === PipelineStageIds.Labeling);

    expect(featureNode?.data.stageSpecialization?.featureEngineeringOriented).toBeTrue();
    expect(labelingNode?.data.stageSpecialization?.annotationOriented).toBeTrue();
    expect(labelingNode?.data.stageSpecialization?.annotationMode).toBe("manual");
  });
});

