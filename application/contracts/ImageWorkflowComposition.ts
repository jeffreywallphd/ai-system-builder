import { z } from "zod";
import { CommonImageNodeKinds, type CommonImageNodeKind } from "../execution/comfyui/image-nodes/CommonImageNodeContracts";
import { ImageWorkflowAssetIntentTypes, type ImageWorkflowAssetIntentType } from "./ImageWorkflowAssetContract";

export const ImageWorkflowCompositionStageKinds = Object.freeze({
  bindInputs: "bind-inputs",
  prepareConditioning: "prepare-conditioning",
  transform: "transform",
  materializeOutput: "materialize-output",
});

export type ImageWorkflowCompositionStageKind =
  typeof ImageWorkflowCompositionStageKinds[keyof typeof ImageWorkflowCompositionStageKinds];

const stageKindSchema = z.enum([
  ImageWorkflowCompositionStageKinds.bindInputs,
  ImageWorkflowCompositionStageKinds.prepareConditioning,
  ImageWorkflowCompositionStageKinds.transform,
  ImageWorkflowCompositionStageKinds.materializeOutput,
]);

const compositionBindingSchema = z.object({
  id: z.string().trim().min(1),
  fieldId: z.string().trim().min(1),
  source: z.enum(["input", "config", "system"]),
  required: z.boolean().default(true),
  description: z.string().trim().min(1),
});

const stepSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  nodeKind: z.enum(CommonImageNodeKinds),
  consumes: z.array(z.string().trim().min(1)).default([]),
  produces: z.array(z.string().trim().min(1)).min(1),
  configBindings: z.array(z.object({
    configFieldId: z.string().trim().min(1),
    targetKey: z.string().trim().min(1),
  })).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const stageSchema = z.object({
  id: z.string().trim().min(1),
  kind: stageKindSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  inspectable: z.boolean().default(true),
  steps: z.array(stepSchema).min(1),
});

export const ImageWorkflowCompositionSchema = z.object({
  compositionId: z.string().trim().min(1),
  intentType: z.enum([
    ImageWorkflowAssetIntentTypes.imageToImage,
    ImageWorkflowAssetIntentTypes.restyle,
    ImageWorkflowAssetIntentTypes.enhanceUpscale,
    ImageWorkflowAssetIntentTypes.batchTransform,
  ]),
  version: z.object({
    compositionVersion: z.string().trim().min(1),
    revision: z.number().int().nonnegative().default(0),
  }),
  bindings: z.object({
    inputs: z.array(compositionBindingSchema).min(1),
    outputs: z.array(compositionBindingSchema).min(1),
  }),
  adapterBoundary: z.object({
    adapterId: z.string().trim().min(1),
    adapterContractVersion: z.string().trim().min(1),
  }),
  stages: z.array(stageSchema).min(1),
  metadata: z.object({
    reusable: z.boolean().default(true),
    preview: z.object({
      mode: z.enum(["single", "comparison", "gallery"]),
      inspectableStageIds: z.array(z.string().trim().min(1)).default([]),
    }),
    tags: z.array(z.string().trim().min(1)).default([]),
  }),
});

export type ImageWorkflowComposition = z.infer<typeof ImageWorkflowCompositionSchema>;
export type ImageWorkflowCompositionStage = z.infer<typeof stageSchema>;
export type ImageWorkflowCompositionStep = z.infer<typeof stepSchema>;

function freezeStep(step: ImageWorkflowCompositionStep): ImageWorkflowCompositionStep {
  return Object.freeze({
    ...step,
    consumes: Object.freeze([...step.consumes]),
    produces: Object.freeze([...step.produces]),
    configBindings: Object.freeze(step.configBindings.map((entry) => Object.freeze({ ...entry }))),
    metadata: Object.freeze({ ...step.metadata }),
  });
}

function freezeStage(stage: ImageWorkflowCompositionStage): ImageWorkflowCompositionStage {
  return Object.freeze({
    ...stage,
    steps: Object.freeze(stage.steps.map((step) => freezeStep(step))),
  });
}

export function createImageWorkflowComposition(input: unknown): ImageWorkflowComposition {
  const parsed = ImageWorkflowCompositionSchema.parse(input);
  return Object.freeze({
    ...parsed,
    version: Object.freeze({ ...parsed.version }),
    bindings: Object.freeze({
      inputs: Object.freeze(parsed.bindings.inputs.map((binding) => Object.freeze({ ...binding }))),
      outputs: Object.freeze(parsed.bindings.outputs.map((binding) => Object.freeze({ ...binding }))),
    }),
    adapterBoundary: Object.freeze({ ...parsed.adapterBoundary }),
    stages: Object.freeze(parsed.stages.map((stage) => freezeStage(stage))),
    metadata: Object.freeze({
      ...parsed.metadata,
      preview: Object.freeze({
        ...parsed.metadata.preview,
        inspectableStageIds: Object.freeze([...parsed.metadata.preview.inspectableStageIds]),
      }),
      tags: Object.freeze([...parsed.metadata.tags]),
    }),
  });
}

export function createReusableImagePipeline(params: {
  readonly compositionId: string;
  readonly intentType: ImageWorkflowAssetIntentType;
  readonly stages: ReadonlyArray<ImageWorkflowCompositionStage>;
  readonly inputBindings: ReadonlyArray<ImageWorkflowComposition["bindings"]["inputs"][number]>;
  readonly outputBindings: ReadonlyArray<ImageWorkflowComposition["bindings"]["outputs"][number]>;
  readonly previewMode: "single" | "comparison" | "gallery";
  readonly inspectableStageIds?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly revision?: number;
  readonly compositionVersion?: string;
}): ImageWorkflowComposition {
  return createImageWorkflowComposition({
    compositionId: params.compositionId,
    intentType: params.intentType,
    version: {
      compositionVersion: params.compositionVersion ?? "1.0.0",
      revision: params.revision ?? 0,
    },
    bindings: {
      inputs: params.inputBindings,
      outputs: params.outputBindings,
    },
    adapterBoundary: {
      adapterId: "image-workflow-execution-adapter",
      adapterContractVersion: "1.0.0",
    },
    stages: params.stages,
    metadata: {
      reusable: true,
      preview: {
        mode: params.previewMode,
        inspectableStageIds: params.inspectableStageIds ?? params.stages.map((stage) => stage.id),
      },
      tags: params.tags ?? ["image-workflow"],
    },
  });
}

export function usesNodeKind(composition: ImageWorkflowComposition, nodeKind: CommonImageNodeKind): boolean {
  return composition.stages.some((stage) => stage.steps.some((step) => step.nodeKind === nodeKind));
}
