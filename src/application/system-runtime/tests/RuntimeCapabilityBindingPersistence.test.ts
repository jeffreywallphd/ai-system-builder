import { describe, expect, it } from "bun:test";
import {
  parsePersistedRuntimeCapabilityBindingEnvelope,
  RuntimeCapabilityBindingPersistenceSchemaVersion,
  validatePersistedRuntimeCapabilityBindingEnvelope,
} from "../RuntimeCapabilityBindingPersistence";

const validEnvelope = {
  schemaVersion: RuntimeCapabilityBindingPersistenceSchemaVersion,
  bindings: [
    {
      persistenceVersion: RuntimeCapabilityBindingPersistenceSchemaVersion,
      bindingContract: {
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
          requiredCapabilityTags: ["image-generation"],
        },
        modelBindingId: "binding:model:sdxl-default",
        executionOptionCapability: {
          sampler: { required: true, defaultValue: "euler", allowedValues: ["euler"] },
          steps: { required: false, minimum: 1, maximum: 60 },
          seed: { required: false, allowDeterministic: true, allowRandom: true },
          guidanceScale: { required: false, minimum: 1, maximum: 20 },
          resolution: { required: false, minimumWidth: 512, minimumHeight: 512 },
          batch: { required: false, minimum: 1, maximum: 4 },
          runtime: { required: false, allowedDevices: ["auto", "gpu"], allowedPrecisions: ["auto", "fp16"] },
        },
        executionOptions: { sampler: "euler" },
        availability: { status: "available", missingCapabilities: [] },
      },
      selectedModelBindingId: "binding:model:sdxl-default",
      selectedExecutionOptions: { sampler: "euler", steps: 30 },
      resolved: {
        resolvedAt: "2026-04-01T00:00:00.000Z",
        resolverVersion: "2.4.7",
        resolvedExecutionOptions: { sampler: "euler", steps: 30 },
      },
      providerPayload: { raw: true },
    },
  ],
};

describe("RuntimeCapabilityBindingPersistence", () => {
  it("serializes and reloads persisted runtime capability bindings while stripping provider payload leakage", () => {
    const parsed = validatePersistedRuntimeCapabilityBindingEnvelope(validEnvelope);

    expect(parsed.schemaVersion).toBe(RuntimeCapabilityBindingPersistenceSchemaVersion);
    expect(parsed.bindings).toHaveLength(1);
    expect(parsed.bindings[0]?.bindingContract.bindingId).toBe("runtime-binding:image-default");
    expect((parsed.bindings[0] as unknown as { readonly providerPayload?: unknown }).providerPayload).toBeUndefined();
  });

  it("rejects unsupported persistence schema versions", () => {
    expect(() => parsePersistedRuntimeCapabilityBindingEnvelope({
      schemaVersion: "0.9.0",
      bindings: [],
    })).toThrow("unsupported-runtime-capability-binding-persistence-version:0.9.0");
  });
});
