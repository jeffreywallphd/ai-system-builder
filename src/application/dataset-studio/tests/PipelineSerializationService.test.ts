import { describe, expect, it } from "bun:test";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";
import { MidLevelPipelineTemplateService } from "../MidLevelPipelineTemplateService";
import { PipelineSerializationService } from "../PipelineSerializationService";

describe("PipelineSerializationService", () => {
  it("round-trips template-instantiated pipelines with deterministic graph reconstruction", () => {
    const templateService = new MidLevelPipelineTemplateService();
    const serializationService = new PipelineSerializationService();
    const instance = templateService.instantiate("analytics-preparation");

    const document = serializationService.toPersistedDocument({
      pipelineId: "analytics-pipeline-1",
      definition: instance.pipelineDefinition,
      templateContext: Object.freeze({
        templateId: instance.template.id,
      }),
    });

    const serialized = serializationService.serialize(document);
    const decoded = serializationService.deserialize(serialized);
    const rehydrated = serializationService.rehydrate(decoded);

    expect(rehydrated.definition).toEqual(instance.pipelineDefinition);
    expect(rehydrated.pipelineGraph).toEqual(instance.pipelineGraph);
    expect(rehydrated.reactFlowGraph).toEqual(instance.reactFlowGraph);
    expect(decoded.graphMetadata.stageIds).toContain(PipelineStageIds.Aggregation);
  });

  it("rejects persisted graph payloads that drift from deterministic reconstruction", () => {
    const templateService = new MidLevelPipelineTemplateService();
    const serializationService = new PipelineSerializationService();
    const instance = templateService.instantiate("general-data-preparation");
    const document = serializationService.toPersistedDocument({
      pipelineId: "general-pipeline-1",
      definition: instance.pipelineDefinition,
    });

    const graph = JSON.parse(document.graph) as {
      readonly nodes: Array<{ id: string }>;
      readonly edges: Array<{ sourceNodeId: string; targetNodeId: string }>;
    };
    const firstNode = graph.nodes[0];
    expect(firstNode).toBeDefined();
    if (firstNode) {
      firstNode.id = "stage:TamperedNode";
    }

    const tampered = Object.freeze({
      ...document,
      graph: JSON.stringify(graph),
    });

    expect(() => serializationService.rehydrate(tampered)).toThrow("not equivalent");
  });
});

