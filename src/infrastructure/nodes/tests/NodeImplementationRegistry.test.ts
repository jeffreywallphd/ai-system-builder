import { describe, expect, it } from "bun:test";
import { NodeImplementationRegistry } from "@shared/NodeImplementationRegistry";
import { NodeImplementationDescriptor } from "@shared/NodeImplementationDescriptor";

const implementation = {
  descriptor: new NodeImplementationDescriptor({
    providerId: "langchain",
    runtimeId: "langchain",
    nodeTypeId: "langchain.prompt-template",
    title: "Prompt Template",
    executionStyles: ["interpreted-node"],
  }),
};

describe("NodeImplementationRegistry", () => {
  it("lists and resolves implementations", () => {
    const registry = new NodeImplementationRegistry({
      providerId: "langchain",
      implementations: [implementation],
    });

    expect(registry.getProviderId()).toBe("langchain");
    expect(registry.listImplementations()).toHaveLength(1);
    expect(registry.findByNodeType("langchain.prompt-template")).toEqual(implementation);
  });

  it("supports provider filtering", () => {
    const registry = new NodeImplementationRegistry({
      providerId: "langchain",
      implementations: [implementation],
    });

    expect(registry.listImplementations({ providerId: "langchain" })).toHaveLength(1);
    expect(registry.listImplementations({ providerId: "python" })).toHaveLength(0);
    expect(
      registry.findByNodeType("langchain.prompt-template", { providerId: "python" })
    ).toBeUndefined();
  });
});

