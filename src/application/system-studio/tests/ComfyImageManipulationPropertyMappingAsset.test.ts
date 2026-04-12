import { describe, expect, it } from "bun:test";
import {
  ComfyImageManipulationPropertyMappingAsset,
  resolveComfyImageManipulationGraphBindings,
} from "../ComfyImageManipulationPropertyMappingAsset";

describe("ComfyImageManipulationPropertyMappingAsset", () => {
  it("defines a reusable, inspectable mapping asset contract", () => {
    expect(ComfyImageManipulationPropertyMappingAsset.assetId).toBe("asset:config-profile:comfy-image-manipulation-property-mapping");
    expect(ComfyImageManipulationPropertyMappingAsset.inputContract.propertySchemaId).toBe("property-schema:image-manipulation");
    expect(ComfyImageManipulationPropertyMappingAsset.outputContract.graphAssetId).toBe("asset:config-profile:comfy-image-manipulation-base-graph");
    expect(ComfyImageManipulationPropertyMappingAsset.configSurface.faceIdExtensionReady).toBeTrue();
    expect(ComfyImageManipulationPropertyMappingAsset.configSurface.supportsFaceIdBindings).toBeTrue();
  });

  it("maps schema fields into validated node override contracts", () => {
    const mapped = resolveComfyImageManipulationGraphBindings({
      prompts: { positivePrompt: "A cozy neon studio", negativePrompt: "grain" },
      generation: {
        width: 1024,
        height: 768,
        steps: 28,
        cfg: 7.25,
        denoiseStrength: 0.52,
        sampler: "euler",
        scheduler: "normal",
        seed: 33,
      },
      models: { checkpointModel: "sdxl.safetensors", vaeModel: "vae-ft-mse-840000-ema-pruned.safetensors", faceIdModel: "faceid-default" },
      output: { resultCount: 2 },
      faceId: {
        enabled: true,
        referenceBindings: [{ datasetBindingId: "faceid-reference", datasetAssetId: "asset:dataset:image-faceid-reference" }],
        weight: 0.9,
        startStepFraction: 0.2,
        endStepFraction: 0.8,
      },
    });

    expect(mapped.graphBindings["4.text"]).toBe("A cozy neon studio");
    expect(mapped.graphBindings["5.text"]).toBe("grain");
    expect(mapped.graphBindings["1.ckpt_name"]).toBe("sdxl.safetensors");
    expect(mapped.graphBindings["9.vae_name"]).toBe("vae-ft-mse-840000-ema-pruned.safetensors");
    expect(mapped.graphBindings["6.steps"]).toBe(28);
    expect(mapped.directNodeOverrides.some((entry) => entry.mode === "direct")).toBeTrue();
    expect(mapped.extensionNodeOverrides.some((entry) => entry.bindingId === "binding.generation.width-extension")).toBeTrue();
    expect(mapped.extensionNodeOverrides.some((entry) => entry.bindingId === "binding.generation.height-extension")).toBeTrue();
    expect(mapped.extensionNodeOverrides.some((entry) => entry.bindingId === "binding.output.result-count-extension")).toBeTrue();
    expect(mapped.extensionNodeOverrides.some((entry) => entry.bindingId === "binding.faceid.model-extension")).toBeTrue();
    expect(mapped.subworkflowBindings[0]).toEqual(expect.objectContaining({
      subworkflowId: "faceid-conditioning",
      enabled: true,
      model: "faceid-default",
      weight: 0.9,
      startStepFraction: 0.2,
      endStepFraction: 0.8,
    }));
  });

  it("keeps non-FaceID execution structurally valid when FaceID is disabled", () => {
    const mapped = resolveComfyImageManipulationGraphBindings({
      prompts: { positivePrompt: "A stylized portrait", negativePrompt: "grain" },
      generation: { steps: 20, cfg: 6.5, denoiseStrength: 0.4, sampler: "euler", scheduler: "normal", seed: 17 },
      models: { checkpointModel: "sdxl.safetensors", vaeModel: "system-default", faceIdModel: "system-default" },
      output: { resultCount: 1 },
      faceId: { enabled: false },
    });

    expect(mapped.graphBindings["4.text"]).toBe("A stylized portrait");
    expect(mapped.subworkflowBindings[0]?.enabled).toBeFalse();
    expect(mapped.subworkflowBindings[0]?.referenceBindings.length).toBeGreaterThan(0);
  });
});
