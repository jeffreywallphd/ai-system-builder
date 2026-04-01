import { z } from "zod";
import { WorkflowInputBindingSourceKinds } from "../../domain/workflow-studio/WorkflowInputBindingDomain";
import {
  createImageWorkflowInputBindingConfiguration,
  type ImageWorkflowInputBindingConfiguration,
} from "./ImageWorkflowInputBindingConfiguration";
import {
  CoreImageWorkflowAssetTypeContracts,
  ImageWorkflowAssetIntentTypes,
  type ImageWorkflowAssetContract,
} from "./ImageWorkflowAssetContract";
import {
  createReusableImagePipeline,
  ImageWorkflowCompositionStageKinds,
  type ImageWorkflowComposition,
} from "./ImageWorkflowComposition";
import { createImageWorkflowAssetPreview, type ImageWorkflowAssetPreview } from "./ImageWorkflowAssetPreview";

export const EnhanceUpscaleWorkflowAssetId = "image-workflow.enhance-upscale";
export const EnhanceUpscaleWorkflowAssetVersion = "1.0.0";

export const EnhanceUpscaleWorkflowAssetConfigSchema = z.object({
  scaleFactor: z.number().min(1).max(4).default(2),
  sharpen: z.boolean().default(true),
  denoise: z.number().min(0).max(1).default(0.15),
});

export type EnhanceUpscaleWorkflowAssetConfig = z.infer<typeof EnhanceUpscaleWorkflowAssetConfigSchema>;

export interface EnhanceUpscaleWorkflowAsset {
  readonly id: typeof EnhanceUpscaleWorkflowAssetId;
  readonly version: typeof EnhanceUpscaleWorkflowAssetVersion;
  readonly intentType: typeof ImageWorkflowAssetIntentTypes.enhanceUpscale;
  readonly contract: ImageWorkflowAssetContract;
  readonly configuration: EnhanceUpscaleWorkflowAssetConfig;
  readonly composition: ImageWorkflowComposition;
  readonly inputBindings: ImageWorkflowInputBindingConfiguration;
  readonly bindings: Readonly<{
    readonly sourceImageFieldId: "sourceImage";
    readonly outputFieldId: "enhancedImage";
  }>;
  readonly preview: ImageWorkflowAssetPreview;
}

function buildEnhanceUpscaleComposition(): ImageWorkflowComposition {
  return createReusableImagePipeline({
    compositionId: `${EnhanceUpscaleWorkflowAssetId}.pipeline.default`,
    intentType: ImageWorkflowAssetIntentTypes.enhanceUpscale,
    previewMode: "comparison",
    tags: ["image-workflow", "enhance", "upscale"],
    inputBindings: [
      { id: "binding.source-image", fieldId: "sourceImage", source: "input", required: true, description: "Canonical source image reference." },
      { id: "binding.scale-factor", fieldId: "scaleFactor", source: "config", required: false, description: "Bounded upscale factor." },
      { id: "binding.sharpen", fieldId: "sharpen", source: "config", required: false, description: "Bounded sharpening flag for post-processing." },
      { id: "binding.denoise", fieldId: "denoise", source: "config", required: false, description: "Bounded denoise amount for enhancement stage." },
    ],
    outputBindings: [
      { id: "binding.enhanced-image", fieldId: "enhancedImage", source: "system", required: true, description: "Canonical enhanced output image reference." },
      { id: "binding.quality-metrics", fieldId: "qualityMetrics", source: "system", required: false, description: "Inspectable enhancement quality metadata." },
    ],
    stages: [
      {
        id: "stage.bind-inputs",
        kind: ImageWorkflowCompositionStageKinds.bindInputs,
        title: "Bind source image",
        description: "Load source image for enhancement/upscale operations.",
        steps: [{ id: "step.load-image", title: "Load source image", nodeKind: "load-image", consumes: ["sourceImage"], produces: ["sourceImageBuffer"] }],
      },
      {
        id: "stage.transform",
        kind: ImageWorkflowCompositionStageKinds.transform,
        title: "Enhance and upscale",
        description: "Apply bounded enhancement and upscale transformation.",
        steps: [
          {
            id: "step.resize-upscale",
            title: "Resize/upscale image",
            nodeKind: "resize-upscale",
            consumes: ["sourceImageBuffer"],
            produces: ["enhancedImageBuffer"],
            configBindings: [
              { configFieldId: "scaleFactor", targetKey: "scaleFactor" },
              { configFieldId: "sharpen", targetKey: "sharpen" },
              { configFieldId: "denoise", targetKey: "denoise" },
            ],
          },
        ],
      },
      {
        id: "stage.materialize-output",
        kind: ImageWorkflowCompositionStageKinds.materializeOutput,
        title: "Materialize enhanced output",
        description: "Persist enhanced image and map quality metadata for inspection.",
        steps: [
          { id: "step.save-image", title: "Persist enhanced image", nodeKind: "save-image", consumes: ["enhancedImageBuffer"], produces: ["enhancedImage"] },
        ],
      },
    ],
  });
}

export function createEnhanceUpscaleWorkflowAsset(input?: {
  readonly configuration?: unknown;
  readonly inputBindings?: ImageWorkflowInputBindingConfiguration["bindings"];
}): EnhanceUpscaleWorkflowAsset {
  const contract = CoreImageWorkflowAssetTypeContracts[ImageWorkflowAssetIntentTypes.enhanceUpscale];
  const configuration = EnhanceUpscaleWorkflowAssetConfigSchema.parse(input?.configuration ?? {});
  const composition = buildEnhanceUpscaleComposition();
  const inputBindings = createImageWorkflowInputBindingConfiguration({
    bindings: input?.inputBindings ?? [
      {
        bindingId: "binding.input.sourceImage",
        inputId: "sourceImage",
        required: true,
        valueType: "object",
        sources: [
          { sourceId: "selected-image", kind: WorkflowInputBindingSourceKinds.selectedImage, path: "assetRef", priority: 1, required: true },
          { sourceId: "form-source-image", kind: WorkflowInputBindingSourceKinds.uiFormValue, formKey: "sourceImage", priority: 2 },
          { sourceId: "dataset-input-image", kind: WorkflowInputBindingSourceKinds.datasetInstanceReference, purpose: "active-input", priority: 3, resolution: { shape: "record", index: 0 } },
        ],
      },
    ],
  });

  return Object.freeze({
    id: EnhanceUpscaleWorkflowAssetId,
    version: EnhanceUpscaleWorkflowAssetVersion,
    intentType: ImageWorkflowAssetIntentTypes.enhanceUpscale,
    contract,
    configuration,
    composition,
    inputBindings,
    bindings: Object.freeze({
      sourceImageFieldId: "sourceImage",
      outputFieldId: "enhancedImage",
    }),
    preview: createImageWorkflowAssetPreview({
      title: "Enhance and upscale",
      summary: "Improves source image quality and resolution via bounded reusable controls.",
      workflowType: "image-workflow",
      intentType: ImageWorkflowAssetIntentTypes.enhanceUpscale,
      contract,
      composition,
    }),
  });
}
