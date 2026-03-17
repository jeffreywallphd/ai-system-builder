import { describe, expect, it } from "bun:test";
import {
  createCompositeNodeImplementationRegistry,
  createNodeProviderRegistries,
} from "../NodeProviderRegistryIndex";

describe("NodeProviderRegistryIndex", () => {
  it("returns all default provider registries", () => {
    const registries = createNodeProviderRegistries();
    expect(registries.map((registry) => registry.getProviderId())).toEqual([
      "comfyui",
      "langchain",
      "python",
      "local",
    ]);
  });

  it("builds a composite registry", () => {
    const composite = createCompositeNodeImplementationRegistry();
    expect(composite.findByNodeType("PromptText")?.descriptor.providerId).toBe("comfyui");
  });
});
