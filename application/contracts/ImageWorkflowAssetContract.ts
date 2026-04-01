import { z } from "zod";
import {
  AssetContractShapeKinds,
  createAssetContractDescriptor,
  type AssetContractDescriptor,
} from "../../domain/contracts/AssetContract";

export const ImageWorkflowAssetIntentTypes = Object.freeze({
  imageToImage: "image-to-image",
  restyle: "restyle",
  enhanceUpscale: "enhance-upscale",
  batchTransform: "batch-transform",
});

export type ImageWorkflowAssetIntentType =
  typeof ImageWorkflowAssetIntentTypes[keyof typeof ImageWorkflowAssetIntentTypes];

const intentTypeSchema = z.enum([
  ImageWorkflowAssetIntentTypes.imageToImage,
  ImageWorkflowAssetIntentTypes.restyle,
  ImageWorkflowAssetIntentTypes.enhanceUpscale,
  ImageWorkflowAssetIntentTypes.batchTransform,
]);

const ioFieldSchema = z.object({
  id: z.string().trim().min(1),
  description: z.string().trim().min(1),
  valueType: z.string().trim().min(1),
  required: z.boolean().default(true),
  allowsMultiple: z.boolean().default(false),
});

const configFieldSchema = z.object({
  id: z.string().trim().min(1),
  description: z.string().trim().min(1),
  valueType: z.string().trim().min(1),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
});

const previewMetadataSchema = z.object({
  mode: z.enum(["single", "comparison", "gallery"]),
  inspectableFields: z.array(z.string().trim().min(1)).min(1),
  sampleOutputLimit: z.number().int().positive().default(1),
});

const compositionMetadataSchema = z.object({
  adapterBoundary: z.object({
    adapterId: z.string().trim().min(1),
    contractVersion: z.string().trim().min(1),
  }),
  dependencies: z.array(z.object({
    role: z.string().trim().min(1),
    assetType: z.string().trim().min(1),
    required: z.boolean().default(true),
  })).default([]),
});

const imageWorkflowAssetVersionSchema = z.object({
  contractVersion: z.string().trim().min(1),
  assetVersion: z.string().trim().min(1).optional(),
  revision: z.number().int().nonnegative().default(0),
});

export const ImageWorkflowAssetContractSchema = z.object({
  identity: z.object({
    assetKind: z.literal("workflow-asset"),
    assetType: z.literal("image-workflow"),
    intentType: intentTypeSchema,
  }),
  intendedUse: z.string().trim().min(1),
  version: imageWorkflowAssetVersionSchema,
  input: z.object({
    fields: z.array(ioFieldSchema).min(1),
  }),
  output: z.object({
    fields: z.array(ioFieldSchema).min(1),
  }),
  config: z.object({
    fields: z.array(configFieldSchema),
  }),
  preview: previewMetadataSchema,
  composition: compositionMetadataSchema,
});

export type ImageWorkflowAssetContract = z.infer<typeof ImageWorkflowAssetContractSchema>;

function freezeContract(contract: ImageWorkflowAssetContract): ImageWorkflowAssetContract {
  return Object.freeze({
    ...contract,
    identity: Object.freeze({ ...contract.identity }),
    version: Object.freeze({ ...contract.version }),
    input: Object.freeze({ fields: Object.freeze(contract.input.fields.map((field) => Object.freeze({ ...field }))) }),
    output: Object.freeze({ fields: Object.freeze(contract.output.fields.map((field) => Object.freeze({ ...field }))) }),
    config: Object.freeze({ fields: Object.freeze(contract.config.fields.map((field) => Object.freeze({ ...field }))) }),
    preview: Object.freeze({
      ...contract.preview,
      inspectableFields: Object.freeze([...contract.preview.inspectableFields]),
    }),
    composition: Object.freeze({
      adapterBoundary: Object.freeze({ ...contract.composition.adapterBoundary }),
      dependencies: Object.freeze(contract.composition.dependencies.map((dependency) => Object.freeze({ ...dependency }))),
    }),
  });
}

export function createImageWorkflowAssetContract(input: unknown): ImageWorkflowAssetContract {
  return freezeContract(ImageWorkflowAssetContractSchema.parse(input));
}

function createCoreTypeContract(contract: Omit<ImageWorkflowAssetContract, "identity"> & {
  readonly intentType: ImageWorkflowAssetIntentType;
}): ImageWorkflowAssetContract {
  return createImageWorkflowAssetContract({
    ...contract,
    identity: {
      assetKind: "workflow-asset",
      assetType: "image-workflow",
      intentType: contract.intentType,
    },
  });
}

export const CoreImageWorkflowAssetTypeContracts = Object.freeze({
  [ImageWorkflowAssetIntentTypes.imageToImage]: createCoreTypeContract({
    intentType: ImageWorkflowAssetIntentTypes.imageToImage,
    intendedUse: "Transform a source image into a new variant while preserving composition anchors.",
    version: { contractVersion: "1.0.0" },
    input: {
      fields: [
        { id: "sourceImage", description: "Primary source image asset reference.", valueType: "image-asset-reference", required: true },
        { id: "instruction", description: "Natural-language transformation instruction.", valueType: "string", required: false },
      ],
    },
    output: {
      fields: [
        { id: "images", description: "Generated image variants.", valueType: "image-asset-reference[]", required: true, allowsMultiple: true },
        { id: "provenance", description: "High-level run provenance and lineage summary.", valueType: "object", required: true },
      ],
    },
    config: {
      fields: [
        { id: "variationStrength", description: "How strongly edits deviate from source image.", valueType: "number", defaultValue: 0.5 },
        { id: "resultCount", description: "Maximum number of returned variants.", valueType: "integer", defaultValue: 1 },
      ],
    },
    preview: {
      mode: "comparison",
      inspectableFields: ["sourceImage", "images", "provenance"],
      sampleOutputLimit: 4,
    },
    composition: {
      adapterBoundary: { adapterId: "image-workflow-execution-adapter", contractVersion: "1.0.0" },
      dependencies: [{ role: "source-image", assetType: "dataset-instance-image-record", required: false }],
    },
  }),
  [ImageWorkflowAssetIntentTypes.restyle]: createCoreTypeContract({
    intentType: ImageWorkflowAssetIntentTypes.restyle,
    intendedUse: "Apply a style intent to an image while preserving recognizable subject structure.",
    version: { contractVersion: "1.0.0" },
    input: {
      fields: [
        { id: "sourceImage", description: "Image to restyle.", valueType: "image-asset-reference", required: true },
        { id: "stylePreset", description: "Named style profile or prompt snippet.", valueType: "string", required: true },
      ],
    },
    output: {
      fields: [
        { id: "images", description: "Restyled outputs.", valueType: "image-asset-reference[]", required: true, allowsMultiple: true },
        { id: "styleSummary", description: "Inspectable style application summary.", valueType: "object", required: false },
      ],
    },
    config: {
      fields: [
        { id: "styleStrength", description: "Blend factor between source and style intent.", valueType: "number", defaultValue: 0.65 },
        { id: "preserveFaces", description: "Prefer preserving facial identity regions when possible.", valueType: "boolean", defaultValue: true },
      ],
    },
    preview: {
      mode: "comparison",
      inspectableFields: ["sourceImage", "images", "styleSummary"],
      sampleOutputLimit: 4,
    },
    composition: {
      adapterBoundary: { adapterId: "image-workflow-execution-adapter", contractVersion: "1.0.0" },
      dependencies: [{ role: "style-reference", assetType: "prompt-template", required: false }],
    },
  }),
  [ImageWorkflowAssetIntentTypes.enhanceUpscale]: createCoreTypeContract({
    intentType: ImageWorkflowAssetIntentTypes.enhanceUpscale,
    intendedUse: "Increase image quality or resolution with bounded enhancement controls.",
    version: { contractVersion: "1.0.0" },
    input: {
      fields: [
        { id: "sourceImage", description: "Image to improve.", valueType: "image-asset-reference", required: true },
      ],
    },
    output: {
      fields: [
        { id: "enhancedImage", description: "Enhanced or upscaled result.", valueType: "image-asset-reference", required: true },
        { id: "qualityMetrics", description: "Bounded inspectable quality metadata.", valueType: "object", required: false },
      ],
    },
    config: {
      fields: [
        { id: "scaleFactor", description: "Upscale multiplier.", valueType: "number", defaultValue: 2 },
        { id: "sharpen", description: "Optional detail enhancement toggle.", valueType: "boolean", defaultValue: true },
      ],
    },
    preview: {
      mode: "comparison",
      inspectableFields: ["sourceImage", "enhancedImage", "qualityMetrics"],
      sampleOutputLimit: 1,
    },
    composition: {
      adapterBoundary: { adapterId: "image-workflow-execution-adapter", contractVersion: "1.0.0" },
      dependencies: [],
    },
  }),
  [ImageWorkflowAssetIntentTypes.batchTransform]: createCoreTypeContract({
    intentType: ImageWorkflowAssetIntentTypes.batchTransform,
    intendedUse: "Apply one transformation policy to a collection of input images.",
    version: { contractVersion: "1.0.0" },
    input: {
      fields: [
        { id: "sourceImages", description: "Batch image input set.", valueType: "image-asset-reference[]", required: true, allowsMultiple: true },
        { id: "instruction", description: "Shared transformation instruction.", valueType: "string", required: false },
      ],
    },
    output: {
      fields: [
        { id: "images", description: "Transformed image outputs.", valueType: "image-asset-reference[]", required: true, allowsMultiple: true },
        { id: "batchSummary", description: "Per-item success/failure and throughput summary.", valueType: "object", required: true },
      ],
    },
    config: {
      fields: [
        { id: "concurrency", description: "Max parallel transformations inside bounded runtime policy.", valueType: "integer", defaultValue: 4 },
        { id: "onItemFailure", description: "Failure handling mode for batch members.", valueType: "string", defaultValue: "continue" },
      ],
    },
    preview: {
      mode: "gallery",
      inspectableFields: ["sourceImages", "images", "batchSummary"],
      sampleOutputLimit: 12,
    },
    composition: {
      adapterBoundary: { adapterId: "image-workflow-execution-adapter", contractVersion: "1.0.0" },
      dependencies: [{ role: "batch-source", assetType: "dataset-instance-image-record", required: true }],
    },
  }),
});

export function listCoreImageWorkflowAssetTypeContracts(): ReadonlyArray<ImageWorkflowAssetContract> {
  return Object.freeze(Object.values(CoreImageWorkflowAssetTypeContracts));
}

export function buildAssetContractForImageWorkflowIntent(intentType: ImageWorkflowAssetIntentType): AssetContractDescriptor {
  const contract = CoreImageWorkflowAssetTypeContracts[intentType];
  return createAssetContractDescriptor({
    version: contract.version.contractVersion,
    input: {
      kind: AssetContractShapeKinds.jsonSchema,
      description: contract.intendedUse,
      schema: {
        type: "object",
        required: contract.input.fields.filter((field) => field.required).map((field) => field.id),
        properties: Object.fromEntries(
          contract.input.fields.map((field) => [field.id, { type: field.valueType, description: field.description }]),
        ),
      },
    },
    output: {
      kind: AssetContractShapeKinds.jsonSchema,
      description: "High-level image workflow output contract.",
      schema: {
        type: "object",
        required: contract.output.fields.filter((field) => field.required).map((field) => field.id),
        properties: Object.fromEntries(
          contract.output.fields.map((field) => [field.id, { type: field.valueType, description: field.description }]),
        ),
      },
    },
    parameters: contract.config.fields.map((field) => ({
      id: field.id,
      description: field.description,
      required: field.required,
      valueType: field.valueType,
      defaultValue: field.defaultValue,
    })),
    execution: {
      invocationMode: intentType === ImageWorkflowAssetIntentTypes.batchTransform ? "async" : "deferred",
      sideEffects: "bounded",
    },
  });
}
