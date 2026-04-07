import { z } from "zod";
import { createImageWorkflowAssetPreview, type ImageWorkflowAssetPreview } from "./ImageWorkflowAssetPreview";
import {
  createImageWorkflowOutputBindingConfiguration,
  type ImageWorkflowOutputBindingConfiguration,
} from "./ImageWorkflowOutputBindingConfiguration";
import {
  createImageWorkflowInputBindingConfiguration,
  type ImageWorkflowInputBindingConfiguration,
} from "./ImageWorkflowInputBindingConfiguration";
import {
  createImageWorkflowUiTriggerBindingConfiguration,
  type ImageWorkflowUiTriggerBindingConfiguration,
} from "./ImageWorkflowUiTriggerBindingConfiguration";
import {
  CoreImageWorkflowAssetTypeContracts,
  ImageWorkflowAssetIntentTypes,
  type ImageWorkflowAssetContract,
} from "./ImageWorkflowAssetContract";
import { WorkflowInputBindingSourceKinds } from "@domain/workflow-studio/WorkflowInputBindingDomain";
import {
  createReusableImagePipeline,
  ImageWorkflowCompositionStageKinds,
  type ImageWorkflowComposition,
} from "./ImageWorkflowComposition";

export const ImageToImageWorkflowAssetId = "image-workflow.image-to-image";
export const ImageToImageWorkflowAssetVersion = "1.0.0";

export const ImageToImageWorkflowAssetConfigSchema = z.object({
  variationStrength: z.number().min(0).max(1).default(0.5),
  resultCount: z.number().int().min(1).max(4).default(1),
  preserveComposition: z.boolean().default(true),
});

export type ImageToImageWorkflowAssetConfig = z.infer<typeof ImageToImageWorkflowAssetConfigSchema>;

export interface ImageToImageWorkflowAsset {
  readonly id: typeof ImageToImageWorkflowAssetId;
  readonly version: typeof ImageToImageWorkflowAssetVersion;
  readonly intentType: typeof ImageWorkflowAssetIntentTypes.imageToImage;
  readonly contract: ImageWorkflowAssetContract;
  readonly configuration: ImageToImageWorkflowAssetConfig;
  readonly composition: ImageWorkflowComposition;
  readonly inputBindings: ImageWorkflowInputBindingConfiguration;
  readonly outputBindings: ImageWorkflowOutputBindingConfiguration;
  readonly uiTriggerBindings: ImageWorkflowUiTriggerBindingConfiguration;
  readonly bindings: Readonly<{
    readonly sourceImageFieldId: "sourceImage";
    readonly promptFieldId: "instruction";
    readonly outputFieldId: "images";
  }>;
  readonly preview: ImageWorkflowAssetPreview;
}


function buildDefaultOutputBindings(): ImageWorkflowOutputBindingConfiguration {
  return createImageWorkflowOutputBindingConfiguration({
    bindings: [
      {
        bindingId: "binding.output.primary",
        outputId: "images",
        targetType: "output-dataset",
        targetId: "workflow-output",
        writeMode: "upsert",
        targetMetadata: { view: "primary" },
        defaultTags: ["output"],
      },
      {
        bindingId: "binding.output.history",
        outputId: "images",
        targetType: "history-dataset",
        targetId: "workflow-output-history",
        writeMode: "append",
        targetMetadata: { view: "history" },
        defaultTags: ["history"],
      },
      {
        bindingId: "binding.output.comparison",
        outputId: "images",
        targetType: "comparison-dataset",
        targetId: "workflow-output-comparison",
        writeMode: "append",
        groupBy: "comparison:image-to-image",
        targetMetadata: { view: "comparison" },
        defaultTags: ["comparison"],
      },
    ],
  });
}

function buildImageToImageComposition(): ImageWorkflowComposition {
  return createReusableImagePipeline({
    compositionId: `${ImageToImageWorkflowAssetId}.pipeline.default`,
    intentType: ImageWorkflowAssetIntentTypes.imageToImage,
    previewMode: "comparison",
    tags: ["image-workflow", "image-to-image"],
    inputBindings: [
      {
        id: "binding.source-image",
        fieldId: "sourceImage",
        source: "input",
        required: true,
        description: "Canonical source image reference.",
      },
      {
        id: "binding.prompt",
        fieldId: "instruction",
        source: "input",
        required: false,
        description: "High-level transformation prompt.",
      },
      {
        id: "binding.variation-strength",
        fieldId: "variationStrength",
        source: "config",
        required: false,
        description: "Bounded variation strength forwarded to transform nodes.",
      },
    ],
    outputBindings: [
      {
        id: "binding.output-images",
        fieldId: "images",
        source: "system",
        required: true,
        description: "Canonical generated image output references.",
      },
    ],
    stages: [
      {
        id: "stage.bind-inputs",
        kind: ImageWorkflowCompositionStageKinds.bindInputs,
        title: "Bind source image",
        description: "Load and normalize source image inputs for transformation execution.",
        steps: [
          {
            id: "step.load-image",
            title: "Load source image",
            nodeKind: "load-image",
            consumes: ["sourceImage"],
            produces: ["sourceImageBuffer"],
            configBindings: [],
          },
        ],
      },
      {
        id: "stage.prepare-conditioning",
        kind: ImageWorkflowCompositionStageKinds.prepareConditioning,
        title: "Prepare conditioning",
        description: "Build prompt conditioning and latent source representation.",
        steps: [
          {
            id: "step.prompt-conditioning",
            title: "Prepare prompt conditioning",
            nodeKind: "prompt-input",
            consumes: ["instruction"],
            produces: ["promptConditioning"],
            configBindings: [],
          },
          {
            id: "step.vae-encode",
            title: "Encode source image",
            nodeKind: "vae-encode",
            consumes: ["sourceImageBuffer"],
            produces: ["sourceLatent"],
            configBindings: [],
          },
        ],
      },
      {
        id: "stage.transform",
        kind: ImageWorkflowCompositionStageKinds.transform,
        title: "Transform image",
        description: "Apply transformation to source latent with bounded config controls.",
        steps: [
          {
            id: "step.sampler",
            title: "Sample transformed latent",
            nodeKind: "sampler-wrapper",
            consumes: ["sourceLatent", "promptConditioning"],
            produces: ["resultLatent"],
            configBindings: [
              {
                configFieldId: "variationStrength",
                targetKey: "denoise",
              },
              {
                configFieldId: "resultCount",
                targetKey: "batchSize",
              },
            ],
          },
          {
            id: "step.decode",
            title: "Decode transformed latent",
            nodeKind: "vae-decode",
            consumes: ["resultLatent"],
            produces: ["resultImageBuffer"],
            configBindings: [],
          },
        ],
      },
      {
        id: "stage.materialize-output",
        kind: ImageWorkflowCompositionStageKinds.materializeOutput,
        title: "Materialize outputs",
        description: "Persist generated images and map to canonical output bindings.",
        steps: [
          {
            id: "step.save-image",
            title: "Persist generated image",
            nodeKind: "save-image",
            consumes: ["resultImageBuffer"],
            produces: ["images"],
            configBindings: [],
          },
        ],
      },
    ],
  });
}

function buildDefaultUiTriggerBindings(): ImageWorkflowUiTriggerBindingConfiguration {
  return createImageWorkflowUiTriggerBindingConfiguration({
    bindings: [
      {
        bindingId: "binding.ui.gallery.open",
        event: { kind: "click", sourceComponentId: "output-gallery", actionId: "open-image", eventName: "ui.image.gallery.open" },
        target: { triggerType: "button-click" },
      },
      {
        bindingId: "binding.ui.parameter.submit",
        event: { kind: "submit", sourceComponentId: "parameter-form", actionId: "submit", eventName: "ui.image.parameter.submit" },
        target: { triggerType: "user-initiated-run" },
      },
      {
        bindingId: "binding.ui.selection.changed",
        event: { kind: "selection", sourceComponentId: "output-gallery", actionId: "select-image", eventName: "ui.image.selection.changed" },
        target: { triggerType: "user-initiated-run" },
      },
    ],
  });
}

export function createImageToImageWorkflowAsset(input?: {
  readonly configuration?: unknown;
  readonly inputBindings?: ImageWorkflowInputBindingConfiguration["bindings"];
  readonly outputBindings?: unknown;
  readonly uiTriggerBindings?: unknown;
}): ImageToImageWorkflowAsset {
  const contract = CoreImageWorkflowAssetTypeContracts[ImageWorkflowAssetIntentTypes.imageToImage];
  const configuration = ImageToImageWorkflowAssetConfigSchema.parse(input?.configuration ?? {});
  const composition = buildImageToImageComposition();
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
        ],
      },
      {
        bindingId: "binding.input.instruction",
        inputId: "instruction",
        required: false,
        valueType: "string",
        defaultValue: "",
        sources: [
          { sourceId: "form-instruction", kind: WorkflowInputBindingSourceKinds.uiFormValue, formKey: "instruction", priority: 1 },
          { sourceId: "runtime-instruction", kind: WorkflowInputBindingSourceKinds.runtimeParameter, parameterKey: "instruction", priority: 2 },
          { sourceId: "default-instruction", kind: WorkflowInputBindingSourceKinds.constantValue, value: "", priority: 3 },
        ],
      },
    ],
  });

  const outputBindings = createImageWorkflowOutputBindingConfiguration(input?.outputBindings ?? buildDefaultOutputBindings());
  const uiTriggerBindings = createImageWorkflowUiTriggerBindingConfiguration(input?.uiTriggerBindings ?? buildDefaultUiTriggerBindings());

  return Object.freeze({
    id: ImageToImageWorkflowAssetId,
    version: ImageToImageWorkflowAssetVersion,
    intentType: ImageWorkflowAssetIntentTypes.imageToImage,
    contract,
    configuration,
    composition,
    inputBindings,
    outputBindings,
    uiTriggerBindings,
    bindings: Object.freeze({
      sourceImageFieldId: "sourceImage",
      promptFieldId: "instruction",
      outputFieldId: "images",
    }),
    preview: createImageWorkflowAssetPreview({
      title: "Image-to-image transform",
      summary: "Transforms a source image with prompt-driven edits using bounded configuration.",
      workflowType: "image-workflow",
      intentType: ImageWorkflowAssetIntentTypes.imageToImage,
      contract,
      composition,
    }),
  });
}

