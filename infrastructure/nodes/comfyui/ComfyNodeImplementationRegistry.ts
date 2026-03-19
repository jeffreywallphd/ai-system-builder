import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";
import { toNodeCatalogDefinitionDescriptor } from "../shared/NodeCatalogDefinitionDescriptor";

function comfyImplementation(
  nodeTypeId: string,
  title: string,
  category: string,
  description: string
): INodeRuntimeImplementation {
  return {
    descriptor: new NodeImplementationDescriptor({
      providerId: "comfyui",
      runtimeId: "comfyui",
      nodeTypeId,
      title,
      executionStyles: ["delegated-workflow"],
      metadata: { category },
      nodeDefinition: toNodeCatalogDefinitionDescriptor({
        title,
        description,
        category,
        inputPorts: [],
        outputPorts: [],
        properties: [],
      }),
    }),
  };
}

const COMFY_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  comfyImplementation(
    "PromptText",
    "Comfy Prompt Text",
    "text/input",
    "Provides text input to a delegated ComfyUI workflow."
  ),
  comfyImplementation(
    "CheckpointLoaderSimple",
    "Comfy Checkpoint Loader",
    "models/loaders",
    "Loads a checkpoint model inside a delegated ComfyUI workflow."
  ),
  comfyImplementation(
    "KSampler",
    "Comfy KSampler",
    "sampling/core",
    "Runs the core sampler step for a delegated ComfyUI workflow."
  ),
  comfyImplementation(
    "SaveImage",
    "Comfy Save Image",
    "image/output",
    "Writes generated images from a delegated ComfyUI workflow."
  ),
]);

export class ComfyNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "comfyui", implementations: COMFY_IMPLEMENTATIONS });
  }
}
