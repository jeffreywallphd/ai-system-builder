import { describe, expect, it } from "bun:test";
import { CanonicalDataShapeKinds } from "../CanonicalDataShapes";
import {
  PipelineStageCategories,
  PipelineStageConfigModes,
  PipelineStageIds,
  createPipelineStageDefinition,
  createPipelineStageInstance,
} from "../PipelineStageDomain";

describe("PipelineStageDomain", () => {
  it("creates a valid pipeline stage definition", () => {
    const definition = createPipelineStageDefinition({
      id: PipelineStageIds.Normalization,
      displayName: "Normalization",
      description: "Normalize canonical values.",
      category: PipelineStageCategories.normalization,
      allowedInputTypes: Object.freeze([CanonicalDataShapeKinds.records]),
      producedOutputTypes: Object.freeze([CanonicalDataShapeKinds.records]),
      isOptional: false,
      defaultEnabled: true,
      orderingConstraints: Object.freeze({
        after: Object.freeze([PipelineStageIds.Profiling]),
      }),
      supportsPreview: true,
    });

    expect(definition.id).toBe(PipelineStageIds.Normalization);
    expect(definition.orderingConstraints.after).toEqual([PipelineStageIds.Profiling]);
  });

  it("rejects self-referential ordering constraints", () => {
    expect(() => createPipelineStageDefinition({
      id: PipelineStageIds.Cleaning,
      displayName: "Cleaning",
      description: "Reject invalid constraints.",
      category: PipelineStageCategories.cleaning,
      allowedInputTypes: Object.freeze([CanonicalDataShapeKinds.records]),
      producedOutputTypes: Object.freeze([CanonicalDataShapeKinds.records]),
      isOptional: true,
      defaultEnabled: true,
      orderingConstraints: Object.freeze({
        before: Object.freeze([PipelineStageIds.Cleaning]),
      }),
      supportsPreview: true,
    })).toThrow("cannot declare ordering constraints against itself");
  });

  it("rejects disabling required stage instances", () => {
    const definition = createPipelineStageDefinition({
      id: PipelineStageIds.UnifiedIngestion,
      displayName: "Unified Ingestion",
      description: "Core ingestion stage.",
      category: PipelineStageCategories.ingestion,
      allowedInputTypes: Object.freeze([CanonicalDataShapeKinds.records]),
      producedOutputTypes: Object.freeze([CanonicalDataShapeKinds.records]),
      isOptional: false,
      defaultEnabled: true,
      orderingConstraints: Object.freeze({}),
      supportsPreview: true,
    });

    expect(() => createPipelineStageInstance({
      definition,
      enabled: false,
    })).toThrow("cannot be disabled");
  });

  it("validates stage instance data-shape compatibility", () => {
    const definition = createPipelineStageDefinition({
      id: PipelineStageIds.Chunking,
      displayName: "Chunking",
      description: "Text-only chunking stage.",
      category: PipelineStageCategories.chunking,
      allowedInputTypes: Object.freeze([CanonicalDataShapeKinds.textItems]),
      producedOutputTypes: Object.freeze([CanonicalDataShapeKinds.textItems]),
      isOptional: true,
      defaultEnabled: true,
      orderingConstraints: Object.freeze({}),
      supportsPreview: true,
    });

    expect(() => createPipelineStageInstance({
      definition,
      config: {
        mode: PipelineStageConfigModes.advanced,
        declaredInputType: CanonicalDataShapeKinds.records,
        options: Object.freeze({}),
      },
    })).toThrow("does not accept declared input type");
  });
});