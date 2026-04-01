import { describe, expect, it } from "bun:test";
import { createRuntimeCapabilityBindingContract } from "../RuntimeCapabilityBindingContract";
import {
  runRuntimeCapabilityPreflight,
  RuntimeCapabilityFailureKinds,
} from "../RuntimeCapabilityExecutionPreflight";

const binding = createRuntimeCapabilityBindingContract({
  bindingId: "runtime-binding:image-default",
  systemAssetId: "system:image-studio",
  executionProvider: {
    providerId: "provider:comfyui",
    providerKind: "image-runtime",
    labels: ["gpu"],
  },
  workflowExecutionProfile: {
    profileId: "profile:txt2img",
    workflowAssetId: "workflow:txt2img",
    executionIntent: "image-generation",
    requiredCapabilityTags: ["image-generation", "model-binding"],
  },
  modelBindingId: "binding:model:sdxl-default",
  executionOptionCapability: {
    sampler: { required: true, defaultValue: "euler", allowedValues: ["euler", "dpmpp_2m"] },
    steps: { required: true, defaultValue: 20, minimum: 1, maximum: 60 },
    seed: { required: true, defaultValue: { mode: "deterministic", value: 1 }, allowDeterministic: true, allowRandom: true },
    guidanceScale: { required: true, defaultValue: 7, minimum: 1, maximum: 30 },
    resolution: { required: true, defaultValue: { width: 1024, height: 1024 }, minimumWidth: 512, minimumHeight: 512, maximumWidth: 2048, maximumHeight: 2048, widthStep: 64, heightStep: 64 },
    batch: { required: false, defaultValue: 1, minimum: 1, maximum: 4 },
    runtime: { required: false, defaultValue: { device: "auto", precision: "auto" }, allowedDevices: ["auto", "cpu", "gpu"], allowedPrecisions: ["auto", "fp16", "bf16", "fp32"] },
  },
  executionOptions: {},
  availability: { status: "available", missingCapabilities: [] },
});

const modelPolicy = {
  policyId: "policy:default",
  allowedBindings: [{ bindingId: "binding:model:sdxl-default", descriptorId: "descriptor:sdxl", required: true }],
  defaultBindingId: "binding:model:sdxl-default",
} as const;

const modelDescriptors = [{
  descriptorId: "descriptor:sdxl",
  modelAssetId: "model:sdxl",
  supportedExecutionProfiles: ["profile:txt2img"],
  supportedExecutionProviders: ["provider:comfyui"],
}] as const;

describe("RuntimeCapabilityExecutionPreflight", () => {
  it("returns provider config on successful validation + translation", () => {
    const result = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      providerId: "provider:comfyui",
      providerCapabilities: ["image-generation", "model-binding"],
      translator: {
        translate: () => ({ ok: true, providerConfig: { mapped: true } }),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providerConfig).toEqual({ mapped: true });
    }
  });

  it("fails for missing model bindings", () => {
    const result = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy: { ...modelPolicy, defaultBindingId: "binding:model:missing" },
      modelDescriptors,
      providerId: "provider:comfyui",
      translator: { translate: () => ({ ok: true, providerConfig: {} }) },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("missing-model-binding");
    }
  });

  it("fails invalid option combinations before provider translation", () => {
    let translationCalled = false;
    const result = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      providerId: "provider:comfyui",
      runtimeOverrides: { runtime: { device: "cpu", precision: "fp16" } },
      translator: {
        translate: () => {
          translationCalled = true;
          return { ok: true, providerConfig: {} };
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(translationCalled).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("invalid-option-combination");
    }
  });

  it("fails unsupported workflow requirements", () => {
    const result = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      providerId: "provider:comfyui",
      providerCapabilities: ["image-generation"],
      translator: { translate: () => ({ ok: true, providerConfig: {} }) },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("unsupported-workflow-requirement");
    }
  });

  it("fails out-of-bounds values", () => {
    const result = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      providerId: "provider:comfyui",
      runtimeOverrides: { steps: 999 },
      translator: { translate: () => ({ ok: true, providerConfig: {} }) },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("out-of-bounds-value");
    }
  });

  it("distinguishes unsupported provider mapping from provider runtime failures", () => {
    const unsupported = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      providerId: "provider:comfyui",
      translator: {
        translate: () => ({ ok: false, code: "unsupported-comfy-sampler", message: "unsupported" }),
      },
    });

    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) {
      expect(unsupported.failure.kind).toBe(RuntimeCapabilityFailureKinds.unsupportedCapabilityMapping);
    }

    const downstreamProviderFailure = {
      kind: RuntimeCapabilityFailureKinds.providerExecutionFailure,
      code: "transport-error",
    } as const;
    expect(downstreamProviderFailure.kind).toBe("provider-execution-failure");
  });
});
