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
    expect(ComfyImageManipulationPropertySchema.version).toBe("1.1.0");
    expect(ComfyImageManipulationPropertySchema.capabilities.composable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.capabilities.inspectable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.capabilities.previewable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.fields.map((group) => group.groupId)).toEqual([
      "prompts",
      "models",
      "generation",
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
    expect(config.output.resultCount).toBe(1);

    const issues = validateComfyImageManipulationConfig({});
    expect(issues).toEqual([]);
  });

  it("enforces non-empty positive prompt and accepts optional negative prompt", () => {
    const issues = validateComfyImageManipulationConfig({
      prompts: { positivePrompt: "   ", negativePrompt: "" },
    });

    expect(issues.some((issue) => issue.path === "prompts.positivePrompt")).toBeTrue();

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
        steps: 20,
        cfg: 6,
        sampler: "dpmpp_2m",
        scheduler: "karras",
        seed: 123,
      },
      output: {
        resultCount: 2,
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
    expect(preview.summary.modelSummary).toContain("base=system-default");
    expect(preview.summary.sampler).toBe("euler");
    expect(preview.summary.scheduler).toBe("normal");
    expect(preview.summary.seed).toBe(1337);
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
    const sampler = generationGroup?.entries.find((entry) => entry.id === "sampler");
    const scheduler = generationGroup?.entries.find((entry) => entry.id === "scheduler");

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
  });

  it("validates generation ranges and selection values", () => {
    const issues = validateComfyImageManipulationConfig({
      generation: {
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
    expect(issues.some((issue) => issue.path === "generation.cfg")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.sampler")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.scheduler")).toBeTrue();
    expect(issues.some((issue) => issue.path === "generation.seed")).toBeTrue();
    expect(issues.some((issue) => issue.path === "models.checkpointModel")).toBeTrue();
    expect(issues.some((issue) => issue.path === "models.vaeModel")).toBeTrue();
    expect(issues.some((issue) => issue.path === "models.faceIdModel")).toBeTrue();
  });
});
