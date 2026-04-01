import { describe, expect, it } from "bun:test";
import {
  createRuntimeCapabilityBindingContract,
  evaluateRuntimeCapabilityAvailability,
  validateRuntimeCapabilityBindingContract,
} from "../RuntimeCapabilityBindingContract";

describe("RuntimeCapabilityBindingContract", () => {
  it("validates and normalizes a compact runtime capability binding contract", () => {
    const contract = createRuntimeCapabilityBindingContract({
      bindingId: "runtime-binding:image-default",
      systemAssetId: "system:image-studio",
      executionProvider: {
        providerId: "provider:image-runtime",
        providerKind: "image-runtime",
        labels: ["gpu", "local"],
      },
      workflowExecutionProfile: {
        profileId: "profile:txt2img",
        workflowAssetId: "workflow:txt2img",
        executionIntent: "image-generation",
        requiredCapabilityTags: ["image-generation", "model-binding"],
      },
      modelBindingId: "binding:model:sdxl-default",
      executionOptionCapability: {
        sampler: { required: true, defaultValue: "euler", allowedValues: ["euler"] },
        steps: { required: true, defaultValue: 30, minimum: 1, maximum: 60 },
        seed: { required: true, defaultValue: { mode: "deterministic", value: 42 }, allowDeterministic: true, allowRandom: true },
        guidanceScale: { required: true, defaultValue: 7, minimum: 1, maximum: 20 },
        resolution: { required: true, defaultValue: { width: 1024, height: 1024 }, minimumWidth: 512, minimumHeight: 512, maximumWidth: 2048, maximumHeight: 2048, widthStep: 64, heightStep: 64 },
        batch: { required: false, defaultValue: 1, minimum: 1, maximum: 8 },
        runtime: { required: false, defaultValue: { device: "auto", precision: "auto" }, allowedDevices: ["auto", "gpu"], allowedPrecisions: ["auto", "fp16"] },
      },
      executionOptions: {
        sampler: "euler",
        steps: 30,
        seed: { mode: "deterministic", value: 42 },
      },
      availability: {
        status: "available",
        missingCapabilities: [],
      },
      metadata: {
        source: "tests",
      },
    });

    expect(contract.bindingId).toBe("runtime-binding:image-default");
    expect(contract.executionProvider.providerKind).toBe("image-runtime");
    expect(contract.workflowExecutionProfile.requiredCapabilityTags).toEqual(["image-generation", "model-binding"]);
    expect(contract.contractVersion).toBe("1.0.0");
  });

  it("rejects invalid runtime capability binding payloads", () => {
    expect(() => validateRuntimeCapabilityBindingContract({
      bindingId: "  ",
      systemAssetId: "system:image-studio",
      executionProvider: { providerId: "provider:image-runtime", providerKind: "image-runtime" },
      workflowExecutionProfile: {
        profileId: "profile:txt2img",
        workflowAssetId: "workflow:txt2img",
        executionIntent: "image-generation",
      },
      modelBindingId: "binding:model:sdxl-default",
      availability: { status: "available" },
    })).toThrow();
  });

  it("evaluates missing provider capabilities deterministically", () => {
    const unavailable = evaluateRuntimeCapabilityAvailability({
      requiredCapabilities: ["image-generation", "model-binding", "batch-execution"],
      providerCapabilities: ["image-generation"],
    });

    expect(unavailable.status).toBe("unavailable");
    expect(unavailable.reasonCode).toBe("missing-runtime-capability");
    expect(unavailable.missingCapabilities).toEqual(["model-binding", "batch-execution"]);
  });
});
