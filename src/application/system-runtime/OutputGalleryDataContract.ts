import { z } from "zod";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";

const canonicalRecordValueSchema: z.ZodType<CanonicalRecordValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(canonicalRecordValueSchema),
  z.record(z.string(), canonicalRecordValueSchema),
]));

const outputGalleryWorkflowReferenceSchema = z.object({
  workflowRunId: z.string().trim().min(1),
  workflowAssetId: z.string().trim().min(1),
  workflowAssetVersionId: z.string().trim().min(1).optional(),
  generationRole: z.string().trim().min(1),
  outputIndex: z.number().int().nonnegative().optional(),
  outputGroupId: z.string().trim().min(1).optional(),
});

const outputGallerySourceImageReferenceSchema = z.object({
  stableId: z.string().trim().min(1).optional(),
  assetId: z.string().trim().min(1).optional(),
  assetVersionId: z.string().trim().min(1).optional(),
  uri: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1).optional(),
  outputId: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.stableId || value.assetId || value.uri || value.path || value.outputId), {
  message: "Source image references require at least one identifying field.",
});

export const OutputGalleryItemSchema = z.object({
  itemId: z.string().trim().min(1),
  image: z.object({
    recordId: z.string().trim().min(1),
    selectionId: z.string().trim().min(1),
    imageReference: z.string().trim().min(1).optional(),
    thumbnailReference: z.string().trim().min(1).optional(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.string().trim().min(1),
    mimeType: z.string().trim().min(1).optional(),
  }),
  dataset: z.object({
    systemId: z.string().trim().min(1),
    instanceId: z.string().trim().min(1),
    datasetAssetId: z.string().trim().min(1),
    datasetAssetVersionId: z.string().trim().min(1).optional(),
    role: z.string().trim().min(1),
    purpose: z.string().trim().min(1).optional(),
  }),
  workflow: outputGalleryWorkflowReferenceSchema.optional(),
  sourceImage: outputGallerySourceImageReferenceSchema.optional(),
  timestamps: z.object({
    admittedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  generationParametersSummary: z.record(z.string().trim().min(1), canonicalRecordValueSchema),
  imageMetadataSummary: z.object({
    metadata: z.record(z.string().trim().min(1), canonicalRecordValueSchema),
    hasAnnotations: z.boolean(),
    hasDerived: z.boolean(),
  }),
  tags: z.array(z.string().trim().min(1)),
  derivedAttributes: z.record(z.string().trim().min(1), canonicalRecordValueSchema),
});

export type OutputGalleryItem = z.infer<typeof OutputGalleryItemSchema>;

export const OutputGalleryListingSchema = z.object({
  kind: z.literal("output-gallery-items"),
  summary: z.object({
    systemId: z.string().trim().min(1),
    datasetInstanceId: z.string().trim().min(1),
    datasetAssetId: z.string().trim().min(1),
    datasetAssetVersionId: z.string().trim().min(1).optional(),
    role: z.string().trim().min(1),
    purpose: z.string().trim().min(1).optional(),
    totalItems: z.number().int().nonnegative(),
    returnedItems: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  window: z.object({
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    hasPreviousWindow: z.boolean(),
    hasNextWindow: z.boolean(),
  }),
  items: z.array(OutputGalleryItemSchema),
});

export type OutputGalleryListing = z.infer<typeof OutputGalleryListingSchema>;

export function validateOutputGalleryItem(input: unknown): OutputGalleryItem {
  return OutputGalleryItemSchema.parse(input);
}

export function validateOutputGalleryListing(input: unknown): OutputGalleryListing {
  return OutputGalleryListingSchema.parse(input);
}
