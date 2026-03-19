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
      "mcp",
      "python",
      "local",
    ]);
  });

  it("builds a composite registry", () => {
    const composite = createCompositeNodeImplementationRegistry();
    expect(composite.findByNodeType("PromptText")?.descriptor.providerId).toBe("comfyui");
    expect(composite.findByNodeType("langchain.llm_chat")?.descriptor.providerId).toBe(
      "langchain"
    );
    expect(composite.findByNodeType("mcp.tool_call")?.descriptor.providerId).toBe("mcp");
  });
});
