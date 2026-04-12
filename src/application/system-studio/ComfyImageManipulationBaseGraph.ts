import { z } from "zod";

export const ComfyImageManipulationBaseGraphAssetId = "asset:config-profile:comfy-image-manipulation-base-graph";
export const ComfyImageManipulationBaseGraphVersionId = "asset:config-profile:comfy-image-manipulation-base-graph:v1";
export const ComfyImageManipulationBaseGraphContractVersion = "1.0.0";

const comfyNodeInputValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.tuple([z.string().trim().min(1), z.number().int().nonnegative()]),
  z.array(comfyNodeInputValueSchema),
  z.record(z.string(), comfyNodeInputValueSchema),
]));

const comfyWorkflowNodeSchema = z.object({
  nodeId: z.string().trim().min(1),
  classType: z.string().trim().min(1),
  inputs: z.record(z.string(), comfyNodeInputValueSchema).default({}),
  title: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
});

const faceIdExtensionAnchorSchema = z.object({
  anchorId: z.literal("faceid-conditioning"),
  description: z.string().trim().min(1),
  injectionPoints: z.object({
    positiveConditioningNodeId: z.string().trim().min(1),
    negativeConditioningNodeId: z.string().trim().min(1),
    samplerNodeId: z.string().trim().min(1),
    notes: z.string().trim().min(1),
  }),
});

const faceIdSubworkflowSchema = z.object({
  subworkflowId: z.literal("faceid-conditioning"),
  kind: z.literal("optional-conditioning-composition"),
  enabledByConfigPath: z.literal("faceId.enabled"),
  datasetReferencePath: z.literal("faceId.referenceBindings"),
  controlPaths: z.object({
    weight: z.literal("faceId.weight"),
    startStepFraction: z.literal("faceId.startStepFraction"),
    endStepFraction: z.literal("faceId.endStepFraction"),
  }),
  anchorId: z.literal("faceid-conditioning"),
  defaultEnabled: z.boolean(),
  notes: z.string().trim().min(1),
});

export const ComfyImageManipulationBaseGraphSchema = z.object({
  assetId: z.literal(ComfyImageManipulationBaseGraphAssetId),
  versionId: z.literal(ComfyImageManipulationBaseGraphVersionId),
  contractVersion: z.literal(ComfyImageManipulationBaseGraphContractVersion),
  intentType: z.literal("image-to-image"),
  executionTarget: z.literal("comfyui"),
  nodes: z.array(comfyWorkflowNodeSchema).min(1),
  outputNodeIds: z.array(z.string().trim().min(1)).min(1),
  extensionAnchors: z.array(faceIdExtensionAnchorSchema),
  subworkflows: z.array(faceIdSubworkflowSchema).default([]),
});

export type ComfyImageManipulationBaseGraph = z.infer<typeof ComfyImageManipulationBaseGraphSchema>;

export const ComfyImageManipulationBaseGraph: ComfyImageManipulationBaseGraph = Object.freeze({
  assetId: ComfyImageManipulationBaseGraphAssetId,
  versionId: ComfyImageManipulationBaseGraphVersionId,
  contractVersion: ComfyImageManipulationBaseGraphContractVersion,
  intentType: "image-to-image",
  executionTarget: "comfyui",
  nodes: Object.freeze([
    Object.freeze({
      nodeId: "1",
      classType: "CheckpointLoaderSimple",
      inputs: Object.freeze({
        ckpt_name: "{{models.checkpointModel}}",
      }),
      title: "Load checkpoint",
      purpose: "Resolve base checkpoint and CLIP/VAE handles.",
    }),
    Object.freeze({
      nodeId: "2",
      classType: "LoadImage",
      inputs: Object.freeze({
        image: "{{inputs.sourceImage}}",
      }),
      title: "Load source image",
      purpose: "Load the selected source image from runtime bindings.",
    }),
    Object.freeze({
      nodeId: "3",
      classType: "VAEEncode",
      inputs: Object.freeze({
        pixels: ["2", 0],
        vae: ["9", 0],
      }),
      title: "Encode source image",
      purpose: "Convert source image to latent space for img2img sampling.",
    }),
    Object.freeze({
      nodeId: "4",
      classType: "CLIPTextEncode",
      inputs: Object.freeze({
        clip: ["1", 1],
        text: "{{prompts.positivePrompt}}",
      }),
      title: "Positive conditioning",
      purpose: "Create positive prompt conditioning.",
    }),
    Object.freeze({
      nodeId: "5",
      classType: "CLIPTextEncode",
      inputs: Object.freeze({
        clip: ["1", 1],
        text: "{{prompts.negativePrompt}}",
      }),
      title: "Negative conditioning",
      purpose: "Create negative prompt conditioning.",
    }),
    Object.freeze({
      nodeId: "6",
      classType: "KSampler",
      inputs: Object.freeze({
        model: ["1", 0],
        positive: ["4", 0],
        negative: ["5", 0],
        latent_image: ["3", 0],
        seed: "{{generation.seed}}",
        steps: "{{generation.steps}}",
        cfg: "{{generation.cfg}}",
        sampler_name: "{{generation.sampler}}",
        scheduler: "{{generation.scheduler}}",
        denoise: "{{generation.denoiseStrength}}",
      }),
      title: "Sample edited latent",
      purpose: "Run img2img sampling with prompt conditioning.",
    }),
    Object.freeze({
      nodeId: "7",
      classType: "VAEDecode",
      inputs: Object.freeze({
        samples: ["6", 0],
        vae: ["9", 0],
      }),
      title: "Decode edited latent",
      purpose: "Decode sampled latent to image space.",
    }),
    Object.freeze({
      nodeId: "9",
      classType: "VAELoader",
      inputs: Object.freeze({
        vae_name: "{{models.vaeModel}}",
      }),
      title: "Load VAE",
      purpose: "Resolve explicit VAE selection for non-embedded and runtime-selected detail models.",
    }),
    Object.freeze({
      nodeId: "8",
      classType: "SaveImage",
      inputs: Object.freeze({
        images: ["7", 0],
        filename_prefix: "ai-loom-image-manipulation",
      }),
      title: "Persist edited image",
      purpose: "Persist edited outputs for downstream dataset materialization.",
    }),
  ]),
  outputNodeIds: Object.freeze(["8"]),
  extensionAnchors: Object.freeze([
    Object.freeze({
      anchorId: "faceid-conditioning",
      description: "Reserved insertion seam for optional FaceID conditioning composition.",
      injectionPoints: Object.freeze({
        positiveConditioningNodeId: "4",
        negativeConditioningNodeId: "5",
        samplerNodeId: "6",
        notes: "Compose FaceID conditioning between CLIP conditioning and sampler inputs without replacing base img2img nodes.",
      }),
    }),
  ]),
  subworkflows: Object.freeze([
    Object.freeze({
      subworkflowId: "faceid-conditioning",
      kind: "optional-conditioning-composition",
      enabledByConfigPath: "faceId.enabled",
      datasetReferencePath: "faceId.referenceBindings",
      controlPaths: Object.freeze({
        weight: "faceId.weight",
        startStepFraction: "faceId.startStepFraction",
        endStepFraction: "faceId.endStepFraction",
      }),
      anchorId: "faceid-conditioning",
      defaultEnabled: false,
      notes: "Optional FaceID conditioning composes into the graph through the faceid-conditioning anchor and keeps the base img2img path executable when disabled.",
    }),
  ]),
});

export function createComfyImageManipulationBaseGraph(input: unknown): ComfyImageManipulationBaseGraph {
  const parsed = ComfyImageManipulationBaseGraphSchema.parse(input);
  const nodeIds = new Set(parsed.nodes.map((node) => node.nodeId));
  if (nodeIds.size !== parsed.nodes.length) {
    throw new Error("Comfy image manipulation base graph cannot contain duplicate node ids.");
  }

  for (const outputNodeId of parsed.outputNodeIds) {
    if (!nodeIds.has(outputNodeId)) {
      throw new Error(`Comfy image manipulation base graph output node '${outputNodeId}' is not defined.`);
    }
  }

  for (const anchor of parsed.extensionAnchors) {
    if (!nodeIds.has(anchor.injectionPoints.positiveConditioningNodeId)) {
      throw new Error(`FaceID extension anchor references unknown positive conditioning node '${anchor.injectionPoints.positiveConditioningNodeId}'.`);
    }
    if (!nodeIds.has(anchor.injectionPoints.negativeConditioningNodeId)) {
      throw new Error(`FaceID extension anchor references unknown negative conditioning node '${anchor.injectionPoints.negativeConditioningNodeId}'.`);
    }
    if (!nodeIds.has(anchor.injectionPoints.samplerNodeId)) {
      throw new Error(`FaceID extension anchor references unknown sampler node '${anchor.injectionPoints.samplerNodeId}'.`);
    }
  }
  const anchorIds = new Set(parsed.extensionAnchors.map((entry) => entry.anchorId));
  for (const subworkflow of parsed.subworkflows) {
    if (!anchorIds.has(subworkflow.anchorId)) {
      throw new Error(`Comfy image manipulation subworkflow '${subworkflow.subworkflowId}' references unknown anchor '${subworkflow.anchorId}'.`);
    }
  }

  return Object.freeze({
    ...parsed,
    nodes: Object.freeze(parsed.nodes.map((node) => Object.freeze({
      ...node,
      inputs: Object.freeze({ ...node.inputs }),
    }))),
    outputNodeIds: Object.freeze([...parsed.outputNodeIds]),
    extensionAnchors: Object.freeze(parsed.extensionAnchors.map((anchor) => Object.freeze({
      ...anchor,
      injectionPoints: Object.freeze({ ...anchor.injectionPoints }),
    }))),
    subworkflows: Object.freeze(parsed.subworkflows.map((subworkflow) => Object.freeze({
      ...subworkflow,
      controlPaths: Object.freeze({ ...subworkflow.controlPaths }),
    }))),
  });
}

export function serializeComfyImageManipulationBaseGraph(graph: ComfyImageManipulationBaseGraph): string {
  return JSON.stringify(createComfyImageManipulationBaseGraph(graph));
}

export function deserializeComfyImageManipulationBaseGraph(serialized: string): ComfyImageManipulationBaseGraph {
  return createComfyImageManipulationBaseGraph(JSON.parse(serialized) as ComfyImageManipulationBaseGraph);
}
