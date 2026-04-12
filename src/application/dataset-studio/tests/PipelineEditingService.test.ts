import { describe, expect, it } from "bun:test";
import { validatePipelineDefinition } from "@domain/dataset-studio/PipelineDefinitionDomain";
import { CanonicalDataShapeKinds } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  createPipelineStageInstance,
  PipelineStageConfigModes,
  PipelineStageIds,
} from "@domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "@domain/dataset-studio/PipelineStageRegistry";
import {
  PipelineEditError,
  PipelineEditErrorCodes,
  PipelineEditingService,
} from "../PipelineEditingService";

function createBaseDefinition() {
  const registry = new PipelineStageRegistry();
  return validatePipelineDefinition(Object.freeze({
    stageInstances: Object.freeze([
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.SourceSelection),
        config: {
          mode: PipelineStageConfigModes.simple,
          expectedOutputType: CanonicalDataShapeKinds.records,
          options: Object.freeze({ outputTarget: "records" }),
        },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.UnifiedIngestion),
        config: {
          mode: PipelineStageConfigModes.simple,
          declaredInputType: CanonicalDataShapeKinds.records,
          expectedOutputType: CanonicalDataShapeKinds.records,
          options: Object.freeze({ outputTarget: "records", strategy: "auto" }),
        },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Transformation),
        config: {
          mode: PipelineStageConfigModes.simple,
          declaredInputType: CanonicalDataShapeKinds.records,
          options: Object.freeze({
            invalidRowStrategy: "annotate-and-keep",
            missingStrategy: "leave",
          }),
        },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.StoragePrepared),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({ destination: "prepared://sample" }) },
      }),
    ]),
  }));
}

describe("PipelineEditingService", () => {
  it("adds and reorders optional stages while regenerating graph + react flow", () => {
    const service = new PipelineEditingService();
    const base = createBaseDefinition();

    const added = service.addStage(base, PipelineStageIds.Profiling, 3);
    expect(added.definition.stageInstances.some((stage) => stage.stageId === PipelineStageIds.Profiling)).toBeTrue();
    expect(added.pipelineGraph.nodes.length).toBeGreaterThan(0);
    expect(added.reactFlowGraph.nodes.length).toBe(added.pipelineGraph.nodes.length);
    expect(base.stageInstances.some((stage) => stage.stageId === PipelineStageIds.Profiling)).toBeFalse();

    const reordered = service.reorderStage(added.definition, PipelineStageIds.Profiling, 2);
    expect(reordered.definition.stageInstances[1]?.stageId).toBe(PipelineStageIds.Profiling);
  });

  it("rejects required stage removal/disable with typed errors", () => {
    const service = new PipelineEditingService();
    const base = createBaseDefinition();

    expect(() => service.removeStage(base, PipelineStageIds.SourceSelection)).toThrow();
    try {
      service.removeStage(base, PipelineStageIds.SourceSelection);
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineEditError);
      expect((error as PipelineEditError).code).toBe(PipelineEditErrorCodes.requiredStageRemoval);
    }

    try {
      service.toggleStage(base, PipelineStageIds.UnifiedIngestion, false);
    } catch (error) {
      expect((error as PipelineEditError).code).toBe(PipelineEditErrorCodes.requiredStageDisable);
    }
  });

  it("replaces stage with deterministic config preservation rules", () => {
    const service = new PipelineEditingService();
    const base = createBaseDefinition();
    const replaced = service.replaceStage(
      base,
      PipelineStageIds.Transformation,
      PipelineStageIds.Cleaning,
    );

    const replacedStage = replaced.definition.stageInstances.find((stage) => stage.stageId === PipelineStageIds.Cleaning);
    expect(replacedStage).toBeDefined();
    expect(replaced.replaceConfigPreservation?.preservedOptionKeys).toEqual(Object.freeze(["missingStrategy"]));
    expect(replaced.replaceConfigPreservation?.droppedOptionKeys).toEqual(Object.freeze(["invalidRowStrategy"]));
    expect(replaced.replaceConfigPreservation?.preservedDeclaredInputType).toBeTrue();
    expect(replaced.replaceConfigPreservation?.preservedExpectedOutputType).toBeFalse();
    expect(replacedStage?.metadata.previewReference).toBeUndefined();
  });

  it("removes optional stages and supports serialization round trip", () => {
    const service = new PipelineEditingService();
    const base = createBaseDefinition();
    const withOptional = service.addStage(base, PipelineStageIds.Enrichment, 4);
    const removed = service.removeStage(withOptional.definition, PipelineStageIds.Enrichment);
    expect(removed.definition.stageInstances.some((stage) => stage.stageId === PipelineStageIds.Enrichment)).toBeFalse();

    const serialized = service.serialize(removed.definition);
    const reloaded = service.deserialize(serialized);
    const regenerated = service.reorderStage(reloaded, PipelineStageIds.StoragePrepared, 4);
    expect(regenerated.pipelineGraph.nodes.length).toBeGreaterThan(0);
    expect(regenerated.reactFlowGraph.edges.length).toBe(regenerated.pipelineGraph.edges.length);
  });

  it("updates labeling stage configuration with safe mode replacement semantics", () => {
    const service = new PipelineEditingService();
    const base = createBaseDefinition();
    const withLabeling = service.addStage(base, PipelineStageIds.Labeling, 4);

    const updated = service.updateStageConfiguration(
      withLabeling.definition,
      PipelineStageIds.Labeling,
      Object.freeze({
        labelingMode: "assisted",
        annotationTarget: "record",
        annotationAttachmentMode: "embedded",
        annotationAllowFreeText: true,
        annotationEmitManualNeeded: true,
        annotationAssistedSeedFromClassification: false,
      }),
    );

    const labelingStage = updated.definition.stageInstances.find((stage) => stage.stageId === PipelineStageIds.Labeling);
    expect(labelingStage?.config.options.labelingMode).toBe("assisted");
    expect(labelingStage?.config.options.annotationTarget).toBe("record");
    expect(updated.pipelineGraph.nodes.some((node) => node.id === "stage:Labeling")).toBeTrue();
  });

  it("rejects edits that create invalid stage compatibility/orderings", () => {
    const service = new PipelineEditingService();
    const base = createBaseDefinition();

    expect(() => service.reorderStage(base, PipelineStageIds.Transformation, 1)).toThrow();
  });
});

