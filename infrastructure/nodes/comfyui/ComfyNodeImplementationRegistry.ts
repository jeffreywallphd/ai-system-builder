import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

const COMFY_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "comfyui",
      runtimeId: "comfyui",
      nodeTypeId: "PromptText",
      title: "Comfy Prompt Text",
      executionStyles: ["delegated-workflow"],
      metadata: { category: "text/input" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "comfyui",
      runtimeId: "comfyui",
      nodeTypeId: "CheckpointLoaderSimple",
      title: "Comfy Checkpoint Loader",
      executionStyles: ["delegated-workflow"],
      metadata: { category: "models/loaders" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "comfyui",
      runtimeId: "comfyui",
      nodeTypeId: "KSampler",
      title: "Comfy KSampler",
      executionStyles: ["delegated-workflow"],
      metadata: { category: "sampling/core" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "comfyui",
      runtimeId: "comfyui",
      nodeTypeId: "SaveImage",
      title: "Comfy Save Image",
      executionStyles: ["delegated-workflow"],
      metadata: { category: "image/output" },
    }),
  },
]);

export class ComfyNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "comfyui", implementations: COMFY_IMPLEMENTATIONS });
  }
}
