import { describe, expect, it } from "bun:test";
import { DatasetPipelineStageKinds } from "../../../domain/dataset-studio/StagePipelineDomain";
import { StageAssetMappingService } from "../StageAssetMappingService";
import {
  listStageTransformationConfigDescriptors,
  listTransformationAssetConfigDescriptors,
  resolveTransformationAssetConfigDescriptor,
} from "../TransformationConfigUxCatalog";
import {
  buildTransformationPipelineStepConfigDescriptor,
  registerTransformationAssets,
} from "../core/data/transformation";

describe("Transformation config UX contracts", () => {
  it("generates zod-aligned config descriptors for multiple transformation assets", () => {
    const descriptors = listTransformationAssetConfigDescriptors();
    expect(descriptors.length).toBeGreaterThanOrEqual(10);

    const schemaInference = descriptors.find((entry) => entry.assetId === "schema-inference");
    const aggregation = descriptors.find((entry) => entry.assetId === "aggregation");
    expect(schemaInference).toBeDefined();
    expect(aggregation).toBeDefined();
    expect(schemaInference?.fields.some((field) => field.key === "inferenceMode")).toBeTrue();
    expect(aggregation?.fields.some((field) => field.key === "groupByFields")).toBeTrue();
  });

  it("supports simple vs advanced grouping metadata", () => {
    const descriptor = resolveTransformationAssetConfigDescriptor({ assetId: "type-normalization" });
    expect(descriptor).toBeDefined();
    const trimStrings = descriptor!.fields.find((field) => field.key === "trimStrings");
    const previewSampleSize = descriptor!.fields.find((field) => field.key === "previewSampleSize");
    expect(trimStrings?.visibility).toBe("simple");
    expect(previewSampleSize?.visibility).toBe("advanced");
    expect(descriptor!.sections.some((section) => section.id === "core")).toBeTrue();
    expect(descriptor!.sections.some((section) => section.id === "advanced")).toBeTrue();
  });

  it("surfaces validation constraints and enum options from zod-backed schemas", () => {
    const descriptor = resolveTransformationAssetConfigDescriptor({ assetId: "data-profiling" });
    expect(descriptor).toBeDefined();
    const sampleSize = descriptor!.fields.find((field) => field.key === "sampleSize");
    expect(sampleSize?.constraints?.length).toBeGreaterThan(0);

    const classification = resolveTransformationAssetConfigDescriptor({ assetId: "data-classification" });
    const confidenceThreshold = classification?.fields.find((field) => field.key === "confidenceThreshold");
    expect(confidenceThreshold?.constraints?.length).toBeGreaterThan(0);
  });

  it("builds pipeline-step UX descriptors aligned to registered step asset configs", () => {
    const { registry } = registerTransformationAssets();
    const descriptor = buildTransformationPipelineStepConfigDescriptor({
      registry,
      step: Object.freeze({
        stepId: "step-1",
        assetId: "filtering",
        config: Object.freeze({
          mode: "include",
          logicalOperator: "and",
          conditions: Object.freeze([]),
        }),
      }),
    });

    expect(descriptor.stepId).toBe("step-1");
    expect(descriptor.assetConfig.assetId).toBe("filtering");
    expect(descriptor.fields.some((field) => field.key === "assetId")).toBeTrue();
    expect(descriptor.assetConfig.fields.some((field) => field.key === "conditions")).toBeTrue();
  });

  it("supports orchestration stage mapping compatibility for step authoring metadata", () => {
    const mappingService = new StageAssetMappingService();
    const transformationStageDescriptors = listStageTransformationConfigDescriptors({
      stageKind: DatasetPipelineStageKinds.transformation,
      mappingService,
    });

    expect(transformationStageDescriptors.length).toBeGreaterThan(0);
    expect(transformationStageDescriptors.some((entry) => entry.assetId === "field-mapping")).toBeTrue();
    expect(transformationStageDescriptors.some((entry) => entry.assetId === "data-validation")).toBeTrue();
    expect(transformationStageDescriptors.every((entry) => entry.descriptor.contractVersion === "1.0.0")).toBeTrue();
  });
});
