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
    expect(ComfyImageManipulationPropertySchema.version).toBe("1.0.0");
    expect(ComfyImageManipulationPropertySchema.capabilities.composable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.capabilities.inspectable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.capabilities.previewable).toBeTrue();
    expect(ComfyImageManipulationPropertySchema.fields.map((group) => group.groupId)).toEqual([
      "prompts",
      "generation",
      "output",
    ]);
  });

  it("provides runnable defaults with no user input", () => {
    const config = createComfyImageManipulationDefaultConfig();

    expect(config.prompts.positivePrompt.length).toBeGreaterThan(0);
    expect(config.prompts.negativePrompt.length).toBeGreaterThan(0);
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
        guidance: 6,
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
  });

  it("maps prompt fields to desired and avoided conditioning surfaces", () => {
    const promptsGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "prompts");
    const positive = promptsGroup?.entries.find((entry) => entry.id === "positivePrompt");
    const negative = promptsGroup?.entries.find((entry) => entry.id === "negativePrompt");

    expect(positive?.mapping).toBe(ComfyConditioningMapping.positivePrompt);
    expect(negative?.mapping).toBe(ComfyConditioningMapping.negativePrompt);
  });
});
