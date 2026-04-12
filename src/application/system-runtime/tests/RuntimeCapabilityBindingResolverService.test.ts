import { describe, expect, it } from "bun:test";
import { resolveRuntimeCapabilityBinding } from "../RuntimeCapabilityBindingResolverService";
import { createRuntimeCapabilityBindingContract, type RuntimeCapabilityBindingContract } from "../RuntimeCapabilityBindingContract";

function createBaseBinding(): RuntimeCapabilityBindingContract {
  return createRuntimeCapabilityBindingContract({
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
      requiredCapabilityTags: ["image-generation"],
    },
    modelBindingId: "binding:model:sdxl-default",
    executionOptionCapability: {
      sampler: { required: true, defaultValue: "euler", allowedValues: ["euler", "dpmpp_2m"] },
      steps: { required: true, defaultValue: 30, minimum: 1, maximum: 60 },
      seed: { required: true, defaultValue: { mode: "random" }, allowDeterministic: true, allowRandom: true },
      guidanceScale: { required: true, defaultValue: 7, minimum: 1, maximum: 20 },
      resolution: {
        required: true,
        defaultValue: { width: 1024, height: 1024 },
        minimumWidth: 512,
        minimumHeight: 512,
        maximumWidth: 2048,
        maximumHeight: 2048,
        widthStep: 64,
        heightStep: 64,
      },
      batch: { required: false, defaultValue: 1, minimum: 1, maximum: 8 },
      runtime: {
        required: false,
        defaultValue: { device: "auto", precision: "auto" },
        allowedDevices: ["auto", "gpu"],
        allowedPrecisions: ["auto", "fp16", "bf16"],
      },
    },
    executionOptions: {},
    availability: {
      status: "available",
      missingCapabilities: [],
    },
  });
}

describe("RuntimeCapabilityBindingResolverService", () => {
  it("resolves defaults deterministically when no overrides are provided", () => {
    const result = resolveRuntimeCapabilityBinding({
      binding: createBaseBinding(),
    });

    expect(result.resolvedExecutionOptions).toEqual({
      sampler: "euler",
      steps: 30,
      seed: { mode: "random" },
      guidanceScale: 7,
      resolution: { width: 1024, height: 1024 },
      batch: { count: 1 },
      runtime: { device: "auto", precision: "auto" },
    });
  });

  it("applies precedence workflow < system < binding < runtime overrides", () => {
    const result = resolveRuntimeCapabilityBinding({
      binding: createBaseBinding(),
      workflowDefaults: { steps: 18, sampler: "euler" },
      systemBindings: { steps: 20, sampler: "dpmpp_2m", batch: { count: 2 } },
      runtimeOverrides: { steps: 40, guidanceScale: 8.5 },
    });

    expect(result.resolvedExecutionOptions.steps).toBe(40);
    expect(result.resolvedExecutionOptions.sampler).toBe("dpmpp_2m");
    expect(result.resolvedExecutionOptions.batch).toEqual({ count: 2 });
    expect(result.resolvedExecutionOptions.guidanceScale).toBe(8.5);
  });

  it("rejects constrained invalid values", () => {
    expect(() => resolveRuntimeCapabilityBinding({
      binding: createBaseBinding(),
      runtimeOverrides: {
        steps: 100,
      },
    })).toThrow("invalid-execution-option:steps:value-above-maximum");
  });

  it("supports partial overrides while retaining normalized output", () => {
    const result = resolveRuntimeCapabilityBinding({
      binding: createBaseBinding(),
      runtimeOverrides: {
        resolution: {
          width: 1536,
          height: 1024,
        },
      },
    });

    expect(result.resolvedExecutionOptions).toEqual({
      sampler: "euler",
      steps: 30,
      seed: { mode: "random" },
      guidanceScale: 7,
      resolution: { width: 1536, height: 1024 },
      batch: { count: 1 },
      runtime: { device: "auto", precision: "auto" },
    });
  });

  it("fails when required values remain missing after merge", () => {
    const binding = createRuntimeCapabilityBindingContract({
      ...createBaseBinding(),
      executionOptionCapability: {
        ...createBaseBinding().executionOptionCapability,
        sampler: {
          required: true,
          allowedValues: ["euler"],
        },
      },
    });

    expect(() => resolveRuntimeCapabilityBinding({
      binding,
    })).toThrow("missing-required-execution-option:sampler");
  });
});
