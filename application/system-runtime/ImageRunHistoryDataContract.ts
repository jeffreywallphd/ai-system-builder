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

const imageReferenceSchema = z.object({
  stableId: z.string().trim().min(1).optional(),
  assetId: z.string().trim().min(1).optional(),
  assetVersionId: z.string().trim().min(1).optional(),
  uri: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1).optional(),
  outputId: z.string().trim().min(1).optional(),
  recordId: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(
  value.stableId
  || value.assetId
  || value.uri
  || value.path
  || value.outputId
  || value.recordId,
), {
  message: "Image references require at least one identifying field.",
});

export const ImageRunHistoryExecutionStatuses = Object.freeze({
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  partial: "partial",
  cancelled: "cancelled",
});

export const ImageRunHistoryRecordSchema = z.object({
  runId: z.string().trim().min(1),
  workflowExecutionId: z.string().trim().min(1).optional(),
  system: z.object({
    systemId: z.string().trim().min(1),
  }),
  workflow: z.object({
    workflowAssetId: z.string().trim().min(1),
    workflowAssetVersionId: z.string().trim().min(1).optional(),
  }),
  inputs: z.object({
    parameterSummary: z.record(z.string().trim().min(1), canonicalRecordValueSchema),
    images: z.array(imageReferenceSchema),
  }),
  outputs: z.object({
    datasetInstance: z.object({
      instanceId: z.string().trim().min(1),
      datasetAssetId: z.string().trim().min(1),
      datasetAssetVersionId: z.string().trim().min(1).optional(),
      role: z.string().trim().min(1),
      purpose: z.string().trim().min(1).optional(),
      persistedRecordIds: z.array(z.string().trim().min(1)),
    }).optional(),
    images: z.array(imageReferenceSchema),
  }),
  status: z.enum([
    ImageRunHistoryExecutionStatuses.queued,
    ImageRunHistoryExecutionStatuses.running,
    ImageRunHistoryExecutionStatuses.completed,
    ImageRunHistoryExecutionStatuses.failed,
    ImageRunHistoryExecutionStatuses.partial,
    ImageRunHistoryExecutionStatuses.cancelled,
  ]),
  lineage: z.object({
    parentRunId: z.string().trim().min(1).optional(),
    triggerEventId: z.string().trim().min(1).optional(),
    outputGroupIds: z.array(z.string().trim().min(1)).optional(),
    status: z.enum(["complete", "partial", "incomplete"]).optional(),
    workflowExecutionId: z.string().trim().min(1).optional(),
    sourceImageAssetId: z.string().trim().min(1).optional(),
    sourceImageRecordId: z.string().trim().min(1).optional(),
    sourceDatasetInstanceId: z.string().trim().min(1).optional(),
    sourceDatasetAssetId: z.string().trim().min(1).optional(),
    workflowAssetId: z.string().trim().min(1).optional(),
    workflowAssetVersionId: z.string().trim().min(1).optional(),
    systemAssetId: z.string().trim().min(1).optional(),
    systemVersionId: z.string().trim().min(1).optional(),
    runtimeSessionId: z.string().trim().min(1).optional(),
    outputDatasetInstanceId: z.string().trim().min(1).optional(),
    outputRecordIds: z.array(z.string().trim().min(1)).optional(),
    traceId: z.string().trim().min(1).optional(),
    missing: z.array(z.string().trim().min(1)).optional(),
  }).optional(),
  timestamps: z.object({
    requestedAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime(),
  }),
});

export type ImageRunHistoryExecutionStatus = z.infer<typeof ImageRunHistoryRecordSchema>["status"];
export type ImageRunHistoryRecord = z.infer<typeof ImageRunHistoryRecordSchema>;

export const ImageRunHistoryListingSchema = z.object({
  kind: z.literal("image-run-history"),
  summary: z.object({
    systemId: z.string().trim().min(1),
    totalRuns: z.number().int().nonnegative(),
    returnedRuns: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  window: z.object({
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    hasPreviousWindow: z.boolean(),
    hasNextWindow: z.boolean(),
  }),
  runs: z.array(ImageRunHistoryRecordSchema),
});

export type ImageRunHistoryListing = z.infer<typeof ImageRunHistoryListingSchema>;

export function validateImageRunHistoryRecord(input: unknown): ImageRunHistoryRecord {
  return ImageRunHistoryRecordSchema.parse(input);
}

export function validateImageRunHistoryListing(input: unknown): ImageRunHistoryListing {
  return ImageRunHistoryListingSchema.parse(input);
}
