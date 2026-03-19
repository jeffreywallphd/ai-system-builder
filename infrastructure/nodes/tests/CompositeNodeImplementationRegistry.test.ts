import { describe, expect, it } from "bun:test";
import { CompositeNodeImplementationRegistry } from "../CompositeNodeImplementationRegistry";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";

function createImplementation(providerId: string, nodeTypeId: string, title = nodeTypeId) {
  return {
    descriptor: new NodeImplementationDescriptor({
      providerId,
      runtimeId: providerId,
      nodeTypeId,
      title,
      executionStyles: ["interpreted-node"],
    }),
  };
}

function createRegistry(providerId: string, nodeTypeIds: ReadonlyArray<string>) {
  return new NodeImplementationRegistry({
    providerId,
    implementations: nodeTypeIds.map((nodeTypeId) => createImplementation(providerId, nodeTypeId)),
  });
}

describe("CompositeNodeImplementationRegistry", () => {
  it("aggregates implementations across registries", () => {
    const alpha = createRegistry("alpha", ["shared.alpha", "alpha.unique"]);
    const beta = createRegistry("beta", ["shared.alpha", "beta.unique"]);
    const composite = new CompositeNodeImplementationRegistry([
      { registry: beta, precedence: 20 },
      { registry: alpha, precedence: 10 },
    ]);

    expect(
      composite.listImplementations().map((implementation) => implementation.descriptor.nodeTypeId)
    ).toEqual(["shared.alpha", "beta.unique", "shared.alpha", "alpha.unique"]);
  });

  it("uses explicit precedence to resolve duplicate node types", () => {
    const alpha = createRegistry("alpha", ["shared.alpha"]);
    const beta = createRegistry("beta", ["shared.alpha"]);
    const composite = new CompositeNodeImplementationRegistry([
      { registry: alpha, precedence: 10 },
      { registry: beta, precedence: 20 },
    ]);

    expect(composite.findByNodeType("shared.alpha")?.descriptor.providerId).toBe("beta");
  });

  it("uses declaration order as a deterministic tiebreaker", () => {
    const alpha = createRegistry("alpha", ["shared.alpha"]);
    const beta = createRegistry("beta", ["shared.alpha"]);
    const composite = new CompositeNodeImplementationRegistry([
      { registry: alpha, precedence: 10 },
      { registry: beta, precedence: 10 },
    ]);

    expect(composite.findByNodeType("shared.alpha")?.descriptor.providerId).toBe("alpha");
  });

  it("still supports provider filtering with precedence entries", () => {
    const alpha = createRegistry("alpha", ["shared.alpha"]);
    const beta = createRegistry("beta", ["shared.alpha", "beta.unique"]);
    const composite = new CompositeNodeImplementationRegistry([
      { registry: alpha, precedence: 10 },
      { registry: beta, precedence: 20 },
    ]);

    expect(
      composite.findByNodeType("shared.alpha", { providerId: "alpha" })?.descriptor.providerId
    ).toBe("alpha");
    expect(
      composite.listImplementations({ providerId: "beta" }).map(
        (implementation) => implementation.descriptor.nodeTypeId
      )
    ).toEqual(["shared.alpha", "beta.unique"]);
  });
});
