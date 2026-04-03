import { describe, expect, it } from "bun:test";
import {
  ComfyConditioningMapping,
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationConfigPreview,
  createComfyImageManipulationDefaultConfig,
  deserializeComfyImageManipulationConfig,
  resolveComfyImageManipulationConfig,
  serializeComfyImageManipulationConfig,
  validateComfyImageManipulationConfig,
} from "../ComfyImageManipulationPropertySchema";

describe("ComfyImageManipulationPropertySchema", () => {
  it("defines a versioned and inspectable property schema asset", () => {
    expect(ComfyImageManipulationPropertySchema.id).toBe("property-schema:image-manipulation");
    expect(ComfyImageManipulationPropertySchema.version).toBe("1.3.0");
    expect(ComfyImageManipulationPropertySchema.capabilities.composable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.capabilities.inspectable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.capabilities.previewable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.fields.map((group) => group.groupId)).toEqual([
      "prompts",
      "models",
      "generation",
      "faceId",
      "output",
    ]);
  });

  it("provides runnable defaults with no user input", () => {
    const config = createComfyImageManipulationDefaultConfig();

    expect(config.prompts.positivePrompt.length).toBeGreaterThan(0);
    expect(config.prompts.negativePrompt.length).toBeGreaterThan(0);
    expect(config.models.checkpointModel).toBe("system-default");
    expect(config.models.vaeModel).toBe("system-default");
    expect(config.models.faceIdModel).toBe("system-default");
    expect(config.generation.sampler).toBe("euler");
    expect(config.generation.scheduler).toBe("normal");
    expect(config.generation.seed).toBe(1337);
    expect(config.generation.width).toBe(1024);
    expect(config.generation.height).toBe(1024);
    expect(config.generation.denoiseStrength).toBe(0.6);
    expect(config.faceId.enabled).toBeFalse();
    expect(config.faceId.referenceBindings[0]).toEqual({
      datasetBindingId: "faceid-reference",
      datasetAssetId: "asset:dataset:image-faceid-reference",
    });
    expect(config.faceId.startStepFraction).toBe(0);
    expect(config.faceId.endStepFraction).toBe(1);
    expect(config.output.resultCount).toBe(1);

    const issues = validateComfyImageManipulationConfig({});
    expect(issues).toEqual([]);
  });

  it("enforces non-empty positive prompt and accepts optional negative prompt", () => {
    const issues = validateComfyImageManipulationConfig({
      prompts: { positivePrompt: "   ", negativePrompt: "" },
    });

    expect(issues.some((issue) => issue.path === "prompts.positivePrompt")).toBeTrue();
    expect(issues.some((issue) => issue.path === "prompts.positivePrompt" && issue.code === "cross-field-invalid")).toBeTrue();

    const resolved = resolveComfyImageManipulationConfig({
      prompts: {
        positivePrompt: "Studio portrait with clean background",
        negativePrompt: "",
      },
    });

    expect(resolved.prompts.negativePrompt).toBe("");
  });

  it("serializes and deserializes resolved configuration", () => {
    const serialized = serializeComfyImageManipulationConfig({
      prompts: {
        positivePrompt: "A cinematic product photo",
      },
      generation: {
        variationStrength: 0.4,
        width: 1024,
        height: 768,
        denoiseStrength: 0.55,
        steps: 20,
        cfg: 6,
        sampler: "dpmpp_2m",
        scheduler: "karras",
        seed: 123,
      },
      output: {
        resultCount: 1,
        outputTarget: "download",
      },
    });

    const parsed = deserializeComfyImageManipulationConfig(serialized);
    expect(parsed.prompts.positivePrompt).toBe("A cinematic product photo");
    expect(parsed.output.outputTarget).toBe("download");
  });

  it("creates a lightweight preview summary before execution", () => {
    const preview = createComfyImageManipulationConfigPreview({
      prompts: {
        positivePrompt: "A highly detailed editorial fashion photo with dramatic backlight and rich color grading",
      },
    });

    expect(preview.schemaId).toBe(ComfyImageManipulationPropertySchema.id);
    expect(preview.summary.positivePromptPreview.length).toBeLessThanOrEqual(81);
    expect(preview.summary.hasNegativePrompt).toBeTrue();
    expect(preview.summary.modelSummary).toContain("Base model: system-default");
    expect(preview.summary.sampler).toBe("euler");
    expect(preview.summary.scheduler).toBe("normal");
    expect(preview.summary.seed).toBe(1337);
    expect(preview.summary.width).toBe(1024);
    expect(preview.summary.height).toBe(1024);
    expect(preview.summary.denoiseStrength).toBe(0.6);
    expect(preview.summary.faceIdEnabled).toBeFalse();
    expect(preview.summary.faceIdSummary).toBe("disabled");
  });

  it("maps prompt fields to desired and avoided conditioning surfaces", () => {
    const promptsGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "prompts");
    const positive = promptsGroup?.entries.find((entry) => entry.id === "positivePrompt");
    const negative = promptsGroup?.entries.find((entry) => entry.id === "negativePrompt");

    expect(positive?.mapping).toBe(ComfyConditioningMapping.positivePrompt);
    expect(negative?.mapping).toBe(ComfyConditioningMapping.negativePrompt);
  });

  it("includes inspectable metadata for model selections and generation mappings", () => {
    const modelsGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "models");
    const checkpointModel = modelsGroup?.entries.find((entry) => entry.id === "checkpointModel");
    const faceIdModel = modelsGroup?.entries.find((entry) => entry.id === "faceIdModel");
    const generationGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "generation");
    const faceIdGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "faceId");
    const sampler = generationGroup?.entries.find((entry) => entry.id === "sampler");
    const scheduler = generationGroup?.entries.find((entry) => entry.id === "scheduler");
    const referenceBindings = faceIdGroup?.entries.find((entry) => entry.id === "referenceBindings");

    expect(checkpointModel?.metadata).toEqual(expect.objectContaining({
      role: "checkpoint",
      optionSource: "runtime-installed-models",
      fallbackResolution: "system-default",
    }));
    expect(faceIdModel?.metadata).toEqual(expect.objectContaining({
      role: "faceid",
      runtimeBinding: "comfy.faceid",
    }));
    expect(sampler?.validation).toEqual(expect.objectContaining({ options: expect.arrayContaining(["euler", "dpmpp_2m"]) }));
    expect(scheduler?.validation).toEqual(expect.objectContaining({ options: expect.arrayContaining(["normal", "karras"]) }));
    expect(referenceBindings?.metadata).toEqual(expect.objectContaining({
      runtimeBinding: "comfy.faceid.references",
      referenceKind: "dataset-binding",
      supportsMultiple: true,
    }));
    expect(sampler?.label).toBe("Render method");
    expect(scheduler?.label).toBe("Step timing");
  });

  it("validates generation ranges and selection values", () => {
    const issues = validateComfyImageManipulationConfig({
      generation: {
        width: 1000,
        height: 65,
        denoiseStrength: 2,
        steps: 0,
        cfg: 40,
        sampler: "unsupported",
        scheduler: "not-real",
        seed: -4,
      },
      models: {
        checkpointModel: "  ",
        vaeModel: "",
        faceIdModel: "   ",
      },
    });

    expect(issues.some((issue) => issue.path === "generation.steps")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.width")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.height")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.denoiseStrength")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.cfg")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.sampler")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.scheduler")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.seed")).toBeTrue();
    expect(issues.some((issue) => issue.path === "models.checkpointModel")).toBeTrue();
    expect(issues.some((issue) => issue.path === "models.vaeModel")).toBeTrue();
    expect(issues.some((issue) => issue.path === "models.faceIdModel")).toBeTrue();
  });

  it("validates output count and FaceID logical consistency", () => {
    const issues = validateComfyImageManipulationConfig({
      output: {
        resultCount: 0,
      },
      faceId: {
        enabled: true,
        referenceBindings: [{ datasetBindingId: "faceid-reference", datasetAssetId: "/tmp/face.png" }],
        startStepFraction: 0.8,
        endStepFraction: 0.2,
      },
    });

    expect(issues.some((issue) => issue.path === "output.resultCount")).toBeTrue();
    expect(issues.some((issue) => issue.path === "faceId.referenceBindings.0.datasetAssetId")).toBeTrue();
    expect(issues.some((issue) => issue.path === "faceId.endStepFraction")).toBeTrue();
  });

  it("enforces cross-field rules for result destination and FaceID references", () => {
    const issues = validateComfyImageManipulationConfig({
      output: {
        resultCount: 3,
        outputTarget: "download",
      },
      faceId: {
        enabled: true,
        referenceBindings: [],
      },
    });

    expect(issues.some((issue) => issue.path === "output.outputTarget" && issue.scope === "cross-field")).toBeTrue();
    expect(issues.some((issue) => issue.path === "faceId.referenceBindings" && issue.code === "cross-field-invalid")).toBeTrue();
  });

  it("summarizes enabled FaceID guidance in preview output", () => {
    const preview = createComfyImageManipulationConfigPreview({
      faceId: {
        enabled: true,
        referenceBindings: [
          { datasetBindingId: "faceid-reference", datasetAssetId: "asset:dataset:image-faceid-reference" },
          { datasetBindingId: "faceid-reference", datasetAssetId: "asset:dataset:image-faceid-reference:v2" },
        ],
        weight: 1.1,
        startStepFraction: 0.1,
        endStepFraction: 0.9,
      },
    });

    expect(preview.summary.faceIdEnabled).toBeTrue();
    expect(preview.summary.faceIdSummary).toContain("on (2 references");
    expect(preview.summary.faceIdSummary).toContain("timing=0.1-0.9");
  });
});
