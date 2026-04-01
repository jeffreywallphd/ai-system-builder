import { z } from "zod";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetInstanceImageGenerationRoles,
  type DatasetInstanceImageGeneration,
  type DatasetInstanceImageGenerationRole,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { ImageAssetReferenceInput } from "../../domain/dataset-studio/contracts/ImageAssetReference";

const canonicalRecordValueSchema: z.ZodType<CanonicalRecordValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(canonicalRecordValueSchema),
  z.record(z.string(), canonicalRecordValueSchema),
]));

const outputStatusSchema = z.enum(["pending", "materialized", "failed", "partial"]);

const imageAssetReferenceSchema = z.object({
  kind: z.enum(["local-file", "generated-output", "external-uri", "canonical-asset"]).optional(),
  stableId: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1).optional(),
  uri: z.string().trim().min(1).optional(),
  outputId: z.string().trim().min(1).optional(),
  sourceSystem: z.string().trim().min(1).optional(),
  sourceContext: z.record(z.string().trim().min(1), z.string().trim().min(1)).optional(),
  mimeTypeHint: z.string().trim().min(1).optional(),
  formatHint: z.string().trim().min(1).optional(),
  assetId: z.string().trim().min(1).optional(),
  assetVersionId: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.stableId || value.path || value.uri || value.outputId || value.assetId), {
  message: "Image asset references require at least one identifying field.",
});

export const WorkflowOutputMaterializationPayloadSchema = z.object({
  materializationId: z.string().trim().min(1),
  workflowRun: z.object({
    runId: z.string().trim().min(1),
    workflowAssetId: z.string().trim().min(1),
    workflowAssetVersionId: z.string().trim().min(1).optional(),
  }),
  sourceImage: z.object({
    imageRef: imageAssetReferenceSchema,
    recordId: z.string().trim().min(1).optional(),
  }).optional(),
  producedAssets: z.array(z.object({
    assetRef: imageAssetReferenceSchema,
    role: z.enum([
      DatasetInstanceImageGenerationRoles.primary,
      DatasetInstanceImageGenerationRoles.variant,
      DatasetInstanceImageGenerationRoles.intermediate,
    ]),
    metadata: z.record(z.string(), canonicalRecordValueSchema).default({}),
    tags: z.array(z.string().trim().min(1)).default([]),
  })).min(1),
  parameterSnapshot: z.record(z.string(), canonicalRecordValueSchema).default({}),
  timestamps: z.object({
    requestedAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime(),
  }),
  status: outputStatusSchema,
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    retriable: z.boolean().optional(),
    details: z.record(z.string(), canonicalRecordValueSchema).optional(),
  }).optional(),
});

export type WorkflowOutputMaterializationPayload = z.infer<typeof WorkflowOutputMaterializationPayloadSchema>;

function normalizeTags(tags: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]);
}

export function validateWorkflowOutputMaterializationPayload(input: unknown): WorkflowOutputMaterializationPayload {
  return WorkflowOutputMaterializationPayloadSchema.parse(input);
}

export function materializationAssetToDatasetGeneration(input: {
  readonly payload: WorkflowOutputMaterializationPayload;
  readonly assetIndex: number;
}): DatasetInstanceImageGeneration {
  const parsed = validateWorkflowOutputMaterializationPayload(input.payload);
  const asset = parsed.producedAssets[input.assetIndex];
  if (!asset) {
    throw new Error(`Materialization asset index '${input.assetIndex}' is out of bounds.`);
  }

  const role: DatasetInstanceImageGenerationRole = asset.role;
  return Object.freeze({
    outputAssetRef: asset.assetRef as ImageAssetReferenceInput,
    sourceImageRef: parsed.sourceImage?.imageRef as ImageAssetReferenceInput | undefined,
    workflowAssetId: parsed.workflowRun.workflowAssetId,
    workflowAssetVersionId: parsed.workflowRun.workflowAssetVersionId,
    runId: parsed.workflowRun.runId,
    role,
    metadata: Object.freeze({
      materializationId: parsed.materializationId,
      status: parsed.status,
      parameterSnapshot: parsed.parameterSnapshot,
      ...asset.metadata,
    }),
    tags: normalizeTags(asset.tags),
  });
}
