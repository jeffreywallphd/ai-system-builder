import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

const LOCAL_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "local",
      runtimeId: "local",
      nodeTypeId: "local.noop",
      title: "Local No-op Node",
      executionStyles: ["interpreted-node", "generic"],
      metadata: { category: "utility" },
    }),
  },
]);

export class LocalNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "local", implementations: LOCAL_IMPLEMENTATIONS });
  }
}
