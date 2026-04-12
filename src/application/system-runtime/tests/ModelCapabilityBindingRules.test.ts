import { describe, expect, it } from "bun:test";
import { resolveModelCapabilityBinding } from "../ModelCapabilityBindingRules";

describe("ModelCapabilityBindingRules", () => {
  const descriptors = Object.freeze([
    Object.freeze({
      descriptorId: "descriptor:model:sdxl",
      modelAssetId: "asset:model:sdxl",
      modelAssetVersionId: "v1",
      supportedExecutionProfiles: ["profile:txt2img", "profile:img2img"],
      supportedExecutionProviders: ["provider:image-runtime"],
      defaultPriority: 10,
      tags: ["sdxl"],
    }),
    Object.freeze({
      descriptorId: "descriptor:model:flux",
      modelAssetId: "asset:model:flux",
      supportedExecutionProfiles: ["profile:txt2img"],
      supportedExecutionProviders: ["provider:future-runtime"],
      defaultPriority: 20,
      tags: ["flux"],
    }),
  ]);

  const policy = Object.freeze({
    policyId: "policy:image-models",
    allowedBindings: [
      {
        bindingId: "binding:model:sdxl-default",
        descriptorId: "descriptor:model:sdxl",
        defaultForProfiles: ["profile:txt2img"],
      },
      {
        bindingId: "binding:model:flux-alt",
        descriptorId: "descriptor:model:flux",
      },
    ],
  });

  it("resolves default bindings when no explicit request is provided", () => {
    const result = resolveModelCapabilityBinding({
      policy,
      descriptors,
      executionProfileId: "profile:txt2img",
      executionProviderId: "provider:image-runtime",
    });

    expect(result.status).toBe("bound");
    expect(result.bindingId).toBe("binding:model:sdxl-default");
    expect(result.descriptorId).toBe("descriptor:model:sdxl");
  });

  it("surfaces missing bindings when request is not allowed", () => {
    const result = resolveModelCapabilityBinding({
      policy,
      descriptors,
      requestedBindingId: "binding:model:unknown",
      executionProfileId: "profile:txt2img",
      executionProviderId: "provider:image-runtime",
    });

    expect(result.status).toBe("missing");
    expect(result.code).toBe("binding-not-allowed");
  });

  it("surfaces incompatible bindings when descriptor does not support provider/profile", () => {
    const result = resolveModelCapabilityBinding({
      policy,
      descriptors,
      requestedBindingId: "binding:model:flux-alt",
      executionProfileId: "profile:txt2img",
      executionProviderId: "provider:image-runtime",
    });

    expect(result.status).toBe("incompatible");
    expect(result.code).toBe("model-incompatible");
    expect(result.bindingId).toBe("binding:model:flux-alt");
  });
});
