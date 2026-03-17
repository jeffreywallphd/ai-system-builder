import { describe, expect, it } from "bun:test";
import { ComfyNodeImplementationRegistry } from "../comfyui/ComfyNodeImplementationRegistry";
import { LangChainNodeImplementationRegistry } from "../langchain/LangChainNodeImplementationRegistry";
import { PythonNodeImplementationRegistry } from "../python/PythonNodeImplementationRegistry";
import { LocalNodeImplementationRegistry } from "../local/LocalNodeImplementationRegistry";

const providerRegistryFactories = [
  () => new ComfyNodeImplementationRegistry(),
  () => new LangChainNodeImplementationRegistry(),
  () => new PythonNodeImplementationRegistry(),
  () => new LocalNodeImplementationRegistry(),
];

describe("Node provider registry contracts", () => {
  it("exposes provider ids and non-empty implementation lists", () => {
    for (const createRegistry of providerRegistryFactories) {
      const registry = createRegistry();
      expect(registry.getProviderId()).toBeTruthy();
      expect(registry.listImplementations().length).toBeGreaterThan(0);

      for (const implementation of registry.listImplementations()) {
        expect(implementation.descriptor.providerId).toBe(registry.getProviderId());
        expect(implementation.descriptor.nodeTypeId).toBeTruthy();
        expect(implementation.descriptor.runtimeId).toBeTruthy();
      }
    }
  });
});
