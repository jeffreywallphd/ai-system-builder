import { ComfyNodeImplementationRegistry } from "./comfyui/ComfyNodeImplementationRegistry";
import { LangChainNodeImplementationRegistry } from "./langchain/LangChainNodeImplementationRegistry";
import { LocalNodeImplementationRegistry } from "./local/LocalNodeImplementationRegistry";
import { PythonNodeImplementationRegistry } from "./python/PythonNodeImplementationRegistry";
import { CompositeNodeImplementationRegistry } from "./CompositeNodeImplementationRegistry";
import type { INodeImplementationRegistry } from "./shared/INodeImplementationRegistry";

const DEFAULT_NODE_PROVIDER_REGISTRIES = Object.freeze([
  () => new ComfyNodeImplementationRegistry(),
  () => new LangChainNodeImplementationRegistry(),
  () => new PythonNodeImplementationRegistry(),
  () => new LocalNodeImplementationRegistry(),
]);

export function createNodeProviderRegistries(): ReadonlyArray<INodeImplementationRegistry> {
  return Object.freeze(DEFAULT_NODE_PROVIDER_REGISTRIES.map((createRegistry) => createRegistry()));
}

export function createCompositeNodeImplementationRegistry(): CompositeNodeImplementationRegistry {
  return new CompositeNodeImplementationRegistry(createNodeProviderRegistries());
}
