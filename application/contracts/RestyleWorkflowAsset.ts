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

export const RestyleWorkflowAssetId = "image-workflow.restyle";
export const RestyleWorkflowAssetVersion = "1.0.0";

export const RestyleWorkflowAssetConfigSchema = z.object({
  styleStrength: z.number().min(0).max(1).default(0.65),
  variationStrength: z.number().min(0).max(1).default(0.45),
  preserveFaces: z.boolean().default(true),
});

export type RestyleWorkflowAssetConfig = z.infer<typeof RestyleWorkflowAssetConfigSchema>;

export interface RestyleWorkflowAsset {
  readonly id: typeof RestyleWorkflowAssetId;
  readonly version: typeof RestyleWorkflowAssetVersion;
  readonly intentType: typeof ImageWorkflowAssetIntentTypes.restyle;
  readonly contract: ImageWorkflowAssetContract;
  readonly configuration: RestyleWorkflowAssetConfig;
  readonly composition: ImageWorkflowComposition;
  readonly inputBindings: ImageWorkflowInputBindingConfiguration;
  readonly bindings: Readonly<{
    readonly sourceImageFieldId: "sourceImage";
    readonly stylePresetFieldId: "stylePreset";
    readonly outputFieldId: "images";
  }>;
  readonly preview: ImageWorkflowAssetPreview;
}

function buildRestyleComposition(): ImageWorkflowComposition {
  return createReusableImagePipeline({
    compositionId: `${RestyleWorkflowAssetId}.pipeline.default`,
    intentType: ImageWorkflowAssetIntentTypes.restyle,
    previewMode: "comparison",
    tags: ["image-workflow", "restyle", "style-transfer"],
    inputBindings: [
      { id: "binding.source-image", fieldId: "sourceImage", source: "input", required: true, description: "Canonical source image reference." },
      { id: "binding.style-preset", fieldId: "stylePreset", source: "input", required: true, description: "Style preset or prompt-oriented style instruction." },
      { id: "binding.style-strength", fieldId: "styleStrength", source: "config", required: false, description: "Bounded style blend strength." },
      { id: "binding.variation-strength", fieldId: "variationStrength", source: "config", required: false, description: "Bounded denoise strength for stylistic variation." },
      { id: "binding.preserve-faces", fieldId: "preserveFaces", source: "config", required: false, description: "Preference hint to preserve facial identity details." },
    ],
    outputBindings: [
      { id: "binding.output-images", fieldId: "images", source: "system", required: true, description: "Canonical restyled image output references." },
      { id: "binding.style-summary", fieldId: "styleSummary", source: "system", required: false, description: "Inspectable style-application summary metadata." },
    ],
    stages: [
      {
        id: "stage.bind-inputs",
        kind: ImageWorkflowCompositionStageKinds.bindInputs,
        title: "Bind source image",
        description: "Load source image for style-oriented transformation.",
        steps: [{ id: "step.load-image", title: "Load source image", nodeKind: "load-image", consumes: ["sourceImage"], produces: ["sourceImageBuffer"] }],
      },
      {
        id: "stage.prepare-conditioning",
        kind: ImageWorkflowCompositionStageKinds.prepareConditioning,
        title: "Prepare style conditioning",
        description: "Build prompt conditioning and latent source image representation.",
        steps: [
          { id: "step.prompt-conditioning", title: "Prepare style prompt", nodeKind: "prompt-input", consumes: ["stylePreset"], produces: ["promptConditioning"] },
          { id: "step.vae-encode", title: "Encode source image", nodeKind: "vae-encode", consumes: ["sourceImageBuffer"], produces: ["sourceLatent"] },
        ],
      },
      {
        id: "stage.transform",
        kind: ImageWorkflowCompositionStageKinds.transform,
        title: "Apply restyle transform",
        description: "Sample a restyled latent from source and style conditioning with bounded controls.",
        steps: [
          {
            id: "step.sampler",
            title: "Sample restyled latent",
            nodeKind: "sampler-wrapper",
            consumes: ["sourceLatent", "promptConditioning"],
            produces: ["restyledLatent"],
            configBindings: [
              { configFieldId: "variationStrength", targetKey: "denoise" },
              { configFieldId: "styleStrength", targetKey: "guidanceScale" },
              { configFieldId: "preserveFaces", targetKey: "preserveFaces" },
            ],
          },
          { id: "step.decode", title: "Decode restyled latent", nodeKind: "vae-decode", consumes: ["restyledLatent"], produces: ["restyledImageBuffer"] },
        ],
      },
      {
        id: "stage.materialize-output",
        kind: ImageWorkflowCompositionStageKinds.materializeOutput,
        title: "Materialize restyled outputs",
        description: "Persist restyled outputs and expose inspectable style summary metadata.",
        steps: [
          { id: "step.save-image", title: "Persist restyled image", nodeKind: "save-image", consumes: ["restyledImageBuffer"], produces: ["images"] },
        ],
      },
    ],
  });
}

export function createRestyleWorkflowAsset(input?: {
  readonly configuration?: unknown;
  readonly inputBindings?: ImageWorkflowInputBindingConfiguration["bindings"];
}): RestyleWorkflowAsset {
  const contract = CoreImageWorkflowAssetTypeContracts[ImageWorkflowAssetIntentTypes.restyle];
  const configuration = RestyleWorkflowAssetConfigSchema.parse(input?.configuration ?? {});
  const composition = buildRestyleComposition();
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
        bindingId: "binding.input.stylePreset",
        inputId: "stylePreset",
        required: true,
        valueType: "string",
        sources: [
          { sourceId: "form-style-preset", kind: WorkflowInputBindingSourceKinds.uiFormValue, formKey: "stylePreset", priority: 1, required: true },
          { sourceId: "runtime-style-preset", kind: WorkflowInputBindingSourceKinds.runtimeParameter, parameterKey: "stylePreset", priority: 2 },
        ],
      },
    ],
  });

  return Object.freeze({
    id: RestyleWorkflowAssetId,
    version: RestyleWorkflowAssetVersion,
    intentType: ImageWorkflowAssetIntentTypes.restyle,
    contract,
    configuration,
    composition,
    inputBindings,
    bindings: Object.freeze({
      sourceImageFieldId: "sourceImage",
      stylePresetFieldId: "stylePreset",
      outputFieldId: "images",
    }),
    preview: createImageWorkflowAssetPreview({
      title: "Image restyle",
      summary: "Applies style-oriented image transformations with bounded reusable controls.",
      workflowType: "image-workflow",
      intentType: ImageWorkflowAssetIntentTypes.restyle,
      contract,
      composition,
    }),
  });
}
