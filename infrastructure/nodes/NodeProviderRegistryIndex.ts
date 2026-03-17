import { ComfyNodeImplementationRegistry } from "./comfyui/ComfyNodeImplementationRegistry";
import { LangChainNodeImplementationRegistry } from "./langchain/LangChainNodeImplementationRegistry";
import { LocalNodeImplementationRegistry } from "./local/LocalNodeImplementationRegistry";
import { PythonNodeImplementationRegistry } from "./python/PythonNodeImplementationRegistry";
import { CompositeNodeImplementationRegistry } from "./CompositeNodeImplementationRegistry";
import type { INodeImplementationRegistry } from "./shared/INodeImplementationRegistry";

export function createNodeProviderRegistries(): ReadonlyArray<INodeImplementationRegistry> {
  return Object.freeze([
    new ComfyNodeImplementationRegistry(),
    new LangChainNodeImplementationRegistry(),
    new PythonNodeImplementationRegistry(),
    new LocalNodeImplementationRegistry(),
  ]);
}

export function createCompositeNodeImplementationRegistry(): CompositeNodeImplementationRegistry {
  return new CompositeNodeImplementationRegistry(createNodeProviderRegistries());
}
