import { ComfyNodeImplementationRegistry } from "./comfyui/ComfyNodeImplementationRegistry";
import { LangChainNodeImplementationRegistry } from "./langchain/LangChainNodeImplementationRegistry";
import { LocalNodeImplementationRegistry } from "./local/LocalNodeImplementationRegistry";
import { PythonNodeImplementationRegistry } from "./python/PythonNodeImplementationRegistry";
import {
  CompositeNodeImplementationRegistry,
  type ICompositeNodeImplementationRegistryEntry,
} from "./CompositeNodeImplementationRegistry";
import type { INodeImplementationRegistry } from "./shared/INodeImplementationRegistry";

const DEFAULT_NODE_PROVIDER_REGISTRIES = Object.freeze([
  () => new ComfyNodeImplementationRegistry(),
  () => new LangChainNodeImplementationRegistry(),
  () => new PythonNodeImplementationRegistry(),
  () => new LocalNodeImplementationRegistry(),
]);

// Higher precedence wins when multiple providers expose the same node type.
const DEFAULT_COMPOSITE_NODE_PROVIDER_ENTRIES = Object.freeze([
  { createRegistry: () => new ComfyNodeImplementationRegistry(), precedence: 400 },
  { createRegistry: () => new LangChainNodeImplementationRegistry(), precedence: 300 },
  { createRegistry: () => new PythonNodeImplementationRegistry(), precedence: 200 },
  { createRegistry: () => new LocalNodeImplementationRegistry(), precedence: 100 },
]);

export function createNodeProviderRegistries(): ReadonlyArray<INodeImplementationRegistry> {
  return Object.freeze(DEFAULT_NODE_PROVIDER_REGISTRIES.map((createRegistry) => createRegistry()));
}

export function createCompositeNodeImplementationRegistry(): CompositeNodeImplementationRegistry {
  return new CompositeNodeImplementationRegistry(
    DEFAULT_COMPOSITE_NODE_PROVIDER_ENTRIES.map(({ createRegistry, precedence }) => ({
      registry: createRegistry(),
      precedence,
    })) satisfies ReadonlyArray<ICompositeNodeImplementationRegistryEntry>
  );
}
