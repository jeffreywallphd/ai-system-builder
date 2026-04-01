import { z } from "zod";
import { createEnhanceUpscaleWorkflowAsset, type EnhanceUpscaleWorkflowAsset } from "./EnhanceUpscaleWorkflowAsset";
import { createRestyleWorkflowAsset, type RestyleWorkflowAsset } from "./RestyleWorkflowAsset";
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
  readonly bindings: Readonly<{
    readonly sourceImageFieldId: "sourceImage";
    readonly promptFieldId: "instruction";
    readonly outputFieldId: "images";
  }>;
  readonly preview: Readonly<{
    readonly title: string;
    readonly summary: string;
    readonly inspectableFields: ReadonlyArray<string>;
    readonly inspectableStageIds: ReadonlyArray<string>;
  }>;
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

export function createImageToImageWorkflowAsset(input?: {
  readonly configuration?: unknown;
}): ImageToImageWorkflowAsset {
  const contract = CoreImageWorkflowAssetTypeContracts[ImageWorkflowAssetIntentTypes.imageToImage];
  const configuration = ImageToImageWorkflowAssetConfigSchema.parse(input?.configuration ?? {});
  const composition = buildImageToImageComposition();

  return Object.freeze({
    id: ImageToImageWorkflowAssetId,
    version: ImageToImageWorkflowAssetVersion,
    intentType: ImageWorkflowAssetIntentTypes.imageToImage,
    contract,
    configuration,
    composition,
    bindings: Object.freeze({
      sourceImageFieldId: "sourceImage",
      promptFieldId: "instruction",
      outputFieldId: "images",
    }),
    preview: Object.freeze({
      title: "Image-to-image transform",
      summary: "Transforms a source image with prompt-driven edits using bounded configuration.",
      inspectableFields: Object.freeze([...contract.preview.inspectableFields]),
      inspectableStageIds: Object.freeze(composition.metadata.preview.inspectableStageIds),
    }),
  });
}

export type ImageWorkflowAssetDefinition = ImageToImageWorkflowAsset | RestyleWorkflowAsset | EnhanceUpscaleWorkflowAsset;

export interface ImageWorkflowAssetRegistryEntry {
  readonly id: string;
  readonly version: string;
  readonly intentType: string;
  readonly title: string;
  readonly summary: string;
}

export class ImageWorkflowAssetRegistry {
  private readonly entries: ReadonlyArray<ImageWorkflowAssetDefinition>;

  public constructor(entries: ReadonlyArray<ImageWorkflowAssetDefinition> = [
    createImageToImageWorkflowAsset(),
    createRestyleWorkflowAsset(),
    createEnhanceUpscaleWorkflowAsset(),
  ]) {
    this.entries = Object.freeze(entries.map((entry) => Object.freeze(entry)));
  }

  public list(): ReadonlyArray<ImageWorkflowAssetRegistryEntry> {
    return Object.freeze(this.entries.map((entry) => Object.freeze({
      id: entry.id,
      version: entry.version,
      intentType: entry.intentType,
      title: entry.preview.title,
      summary: entry.preview.summary,
    })));
  }

  public getByIntent(intentType: string): ImageWorkflowAssetDefinition | undefined {
    return this.entries.find((entry) => entry.intentType === intentType);
  }
}

export function createDefaultImageWorkflowAssetRegistry(): ImageWorkflowAssetRegistry {
  return new ImageWorkflowAssetRegistry();
}
