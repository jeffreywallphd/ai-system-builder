import { describe, expect, it } from "bun:test";
import { createRuntimeCapabilityBindingContract } from "../RuntimeCapabilityBindingContract";
import { runRuntimeCapabilityPreflight, RuntimeCapabilityFailureKinds } from "../RuntimeCapabilityExecutionPreflight";
import { validatePersistedRuntimeCapabilityBindingEnvelope } from "../RuntimeCapabilityBindingPersistence";
import { ComfyRuntimeCapabilityTranslator } from "../../../infrastructure/comfyui/execution/mappers/ComfyRuntimeCapabilityTranslator";

const binding = createRuntimeCapabilityBindingContract({
  bindingId: "runtime-binding:image-default",
  systemAssetId: "system:image:1",
  modelBindingId: "binding:model:default",
  workflowExecutionProfile: {
    profileId: "workflow-profile:image",
    workflowAssetId: "workflow:image:1",
    executionIntent: "image-generation",
    requiredCapabilityTags: ["image", "diffusion"],
  },
  executionProvider: {
    providerId: "comfyui-local",
    providerKind: "image-runtime",
    labels: [],
  },
  executionOptionCapability: {
    sampler: { required: true, allowedValues: ["euler", "dpmpp_2m"], defaultValue: "euler" },
    steps: { required: true, minimum: 1, maximum: 100, defaultValue: 20 },
    guidanceScale: { required: false, minimum: 1, maximum: 20, defaultValue: 7 },
    seed: { required: false, allowDeterministic: true, allowRandom: true, defaultValue: { mode: "random" } },
    resolution: { required: false, minimumWidth: 64, maximumWidth: 2048, minimumHeight: 64, maximumHeight: 2048, widthStep: 8, heightStep: 8 },
    batch: { required: false, minimum: 1, maximum: 4, defaultValue: 1 },
    runtime: { required: false, allowedDevices: ["auto", "gpu", "cpu"], allowedPrecisions: ["auto", "fp16", "fp32"], defaultValue: { device: "auto", precision: "auto" } },
  },
  executionOptions: { sampler: "euler", steps: 24, resolution: { width: 1024, height: 1024 } },
  availability: { status: "available", missingCapabilities: [] },
});

const modelPolicy = {
  policyId: "policy:image-runtime",
  defaultBindingId: "binding:model:default",
  allowedBindings: [
    {
      bindingId: "binding:model:default",
      descriptorId: "descriptor:sdxl-default",
      required: true,
      defaultForProfiles: ["workflow-profile:image"],
    },
  ],
};

const modelDescriptors = [
  {
    descriptorId: "descriptor:sdxl-default",
    modelAssetId: "model:sdxl:base",
    supportedExecutionProfiles: ["workflow-profile:image"],
    supportedExecutionProviders: ["comfyui-local"],
    tags: ["image", "diffusion"],
  },
] as const;

describe("RuntimeCapabilityBinding end-to-end flow", () => {
  it("applies precedence, translates provider config, and persists bounded trace metadata", () => {
    const translator = new ComfyRuntimeCapabilityTranslator();
    const preflight = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      requestedModelBindingId: "binding:model:default",
      providerId: "comfyui-local",
      providerCapabilities: ["image", "diffusion", "sampler"],
      workflowDefaults: { steps: 10, sampler: "euler" },
      systemBindings: { steps: 18 },
      runtimeOverrides: { steps: 32, sampler: "dpmpp_2m", guidanceScale: 8 },
      translator,
    });

    expect(preflight.ok).toBe(true);
    if (!preflight.ok) {
      return;
    }
    expect(preflight.resolvedExecutionOptions.steps).toBe(32);
    expect(preflight.providerConfig.samplerName).toBe("dpmpp_2m");

    const persisted = validatePersistedRuntimeCapabilityBindingEnvelope({
      schemaVersion: "1.0.0",
      bindings: [
        {
          persistenceVersion: "1.0.0",
          bindingContract: binding,
          selectedModelBindingId: preflight.modelBinding.bindingId,
          selectedExecutionOptions: { steps: 32, sampler: "dpmpp_2m", guidanceScale: 8 },
          resolved: {
            resolvedAt: "2026-04-01T00:00:00.000Z",
            resolverVersion: "1.0.0",
            resolvedExecutionOptions: preflight.resolvedExecutionOptions,
          },
        },
      ],
    });

    expect(persisted.bindings[0]?.resolved?.resolvedExecutionOptions.steps).toBe(32);
    expect((persisted.bindings[0] as unknown as { providerPayload?: unknown }).providerPayload).toBeUndefined();
  });

  it("fails with structured validation failures for missing models and provider mismatch", () => {
    const translator = new ComfyRuntimeCapabilityTranslator();

    const missingModel = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors: [],
      providerId: "comfyui-local",
      providerCapabilities: ["image", "diffusion"],
      translator,
    });
    expect(missingModel.ok).toBe(false);
    if (!missingModel.ok) {
      expect(missingModel.failure.kind).toBe(RuntimeCapabilityFailureKinds.validationFailure);
      expect(missingModel.failure.code).toBe("missing-model-binding");
    }

    const providerMismatch = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      providerId: "other-provider",
      providerCapabilities: ["image", "diffusion"],
      translator,
    });
    expect(providerMismatch.ok).toBe(false);
    if (!providerMismatch.ok) {
      expect(providerMismatch.failure.code).toBe("provider-mismatch");
    }
  });

  it("fails translation at provider boundary with structured unsupported mapping failure", () => {
    const unsupported = runRuntimeCapabilityPreflight({
      binding,
      modelPolicy,
      modelDescriptors,
      providerId: "comfyui-local",
      providerCapabilities: ["image", "diffusion"],
      runtimeOverrides: { sampler: "euler" },
      translator: {
        translate: () => ({ ok: false as const, code: "provider-option-unsupported", message: "unsupported option" }),
      },
    });

    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) {
      expect(unsupported.failure.kind).toBe(RuntimeCapabilityFailureKinds.unsupportedCapabilityMapping);
      expect(unsupported.failure.code).toBe("provider-option-unsupported");
    }
  });
});
