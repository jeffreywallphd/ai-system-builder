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
  });

  it("maps schema fields into deterministic Comfy graph binding keys", () => {
    const mapped = resolveComfyImageManipulationGraphBindings({
      prompts: { positivePrompt: "A cozy neon studio", negativePrompt: "grain" },
      generation: { steps: 28, cfg: 7.25, denoiseStrength: 0.52, sampler: "euler", scheduler: "normal", seed: 33 },
      models: { checkpointModel: "sdxl.safetensors", vaeModel: "vae-ft-mse-840000-ema-pruned.safetensors", faceIdModel: "faceid-default" },
      output: { resultCount: 2 },
      faceId: { enabled: true, weight: 0.9, startAt: 0.2, endAt: 0.8, referenceSelectionMode: "top-ranked", maxReferenceImages: 2 },
    });

    expect(mapped.graphBindings["4.text"]).toBe("A cozy neon studio");
    expect(mapped.graphBindings["5.text"]).toBe("grain");
    expect(mapped.graphBindings["1.ckpt_name"]).toBe("sdxl.safetensors");
    expect(mapped.graphBindings["9.vae_name"]).toBe("vae-ft-mse-840000-ema-pruned.safetensors");
    expect(mapped.graphBindings["6.steps"]).toBe(28);
    expect(mapped.extensionBindings.some((entry) => entry.bindingId === "binding.faceid.enabled-extension")).toBeTrue();
    expect(mapped.extensionBindings.some((entry) => entry.bindingId === "binding.image.result-count-extension")).toBeTrue();
    expect(mapped.extensionBindings.some((entry) => entry.bindingId === "binding.model.vae")).toBeFalse();
  });
});
