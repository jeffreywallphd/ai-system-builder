import { describe, expect, it } from "bun:test";
import { ComfyRuntimeCapabilityTranslator } from "../mappers/ComfyRuntimeCapabilityTranslator";
import { createRuntimeCapabilityBindingContract } from "@application/system-runtime/RuntimeCapabilityBindingContract";

const binding = createRuntimeCapabilityBindingContract({
  bindingId: "binding:1",
  systemAssetId: "system:1",
  executionProvider: { providerId: "provider:comfyui", providerKind: "image-runtime", labels: [] },
  workflowExecutionProfile: {
    profileId: "profile:txt2img",
    workflowAssetId: "workflow:txt2img",
    executionIntent: "image-generation",
    requiredCapabilityTags: [],
  },
  modelBindingId: "binding:model:sdxl",
  executionOptionCapability: {},
  executionOptions: {},
  availability: { status: "available", missingCapabilities: [] },
});

describe("ComfyRuntimeCapabilityTranslator", () => {
  it("maps resolved runtime capability options to ComfyUI execution config", () => {
    const translator = new ComfyRuntimeCapabilityTranslator();
    const result = translator.translate({
      binding,
      modelBinding: { status: "bound", bindingId: "binding:model:sdxl", descriptorId: "descriptor:sdxl" },
      resolvedExecutionOptions: {
        sampler: "euler",
        steps: 30,
        guidanceScale: 7,
        resolution: { width: 1024, height: 1024 },
        seed: { mode: "deterministic", value: 123 },
        batch: { count: 2 },
        runtime: { device: "gpu", precision: "fp16" },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providerConfig.samplerName).toBe("euler");
      expect(result.providerConfig.cfg).toBe(7);
      expect(result.providerConfig.checkpointBindingId).toBe("binding:model:sdxl");
    }
  });

  it("returns unsupported mapping for unsupported sampler", () => {
    const translator = new ComfyRuntimeCapabilityTranslator();
    const result = translator.translate({
      binding,
      modelBinding: { status: "bound", bindingId: "binding:model:sdxl", descriptorId: "descriptor:sdxl" },
      resolvedExecutionOptions: {
        sampler: "unsupported",
        resolution: { width: 1024, height: 1024 },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unsupported-comfy-sampler");
    }
  });
});

