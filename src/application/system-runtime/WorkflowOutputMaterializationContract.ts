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

const workflowOutputBinaryPayloadSchema = z.object({
  dataBase64: z.string().trim().min(1),
  fileNameHint: z.string().trim().min(1).optional(),
  extensionHint: z.string().trim().min(1).optional(),
  mimeTypeHint: z.string().trim().min(1).optional(),
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
  sourceImages: z.array(z.object({
    imageRef: imageAssetReferenceSchema,
    recordId: z.string().trim().min(1).optional(),
  })).optional(),
  producedAssets: z.array(z.object({
    assetRef: imageAssetReferenceSchema,
    role: z.enum([
      DatasetInstanceImageGenerationRoles.primary,
      DatasetInstanceImageGenerationRoles.variant,
      DatasetInstanceImageGenerationRoles.intermediate,
    ]),
    metadata: z.record(z.string(), canonicalRecordValueSchema).default({}),
    tags: z.array(z.string().trim().min(1)).default([]),
    outputIndex: z.number().int().nonnegative().optional(),
    outputGroupId: z.string().trim().min(1).optional(),
    sourceImageRef: imageAssetReferenceSchema.optional(),
    binaryPayload: workflowOutputBinaryPayloadSchema.optional(),
  })),
  parameterSnapshot: z.record(z.string(), canonicalRecordValueSchema).default({}),
  executionContext: z.object({
    runtimeProfile: z.string().trim().min(1).optional(),
    capabilityProfile: z.record(z.string(), canonicalRecordValueSchema).default({}),
    configurationSnapshot: z.record(z.string(), canonicalRecordValueSchema).default({}),
  }).default({}),
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
}).superRefine((value, context) => {
  if (value.status === "failed" && value.producedAssets.length === 0) {
    return;
  }
  if (value.producedAssets.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["producedAssets"],
      message: "Materialization payloads require at least one produced asset unless status is failed.",
    });
  }
});

export type WorkflowOutputMaterializationPayload = z.infer<typeof WorkflowOutputMaterializationPayloadSchema>;

function normalizeTags(tags: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]);
}

export function decodeWorkflowBinaryPayload(payload: {
  readonly dataBase64: string;
}): Uint8Array {
  const normalized = payload.dataBase64.trim();
  if (!normalized) {
    throw new Error("Workflow output binary payload cannot be empty.");
  }
  const buffer = Buffer.from(normalized, "base64");
  if (buffer.length === 0) {
    throw new Error("Workflow output binary payload decoded to an empty buffer.");
  }
  return new Uint8Array(buffer);
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
  const sourceImageRef = asset.sourceImageRef ?? parsed.sourceImage?.imageRef ?? parsed.sourceImages?.[0]?.imageRef;
  return Object.freeze({
    outputAssetRef: asset.assetRef as ImageAssetReferenceInput,
    sourceImageRef: sourceImageRef as ImageAssetReferenceInput | undefined,
    workflowAssetId: parsed.workflowRun.workflowAssetId,
    workflowAssetVersionId: parsed.workflowRun.workflowAssetVersionId,
    runId: parsed.workflowRun.runId,
    role,
    outputIndex: asset.outputIndex ?? input.assetIndex,
    outputGroupId: asset.outputGroupId ?? `run:${parsed.workflowRun.runId}`,
    metadata: Object.freeze({
      materializationId: parsed.materializationId,
      status: parsed.status,
      parameterSnapshot: parsed.parameterSnapshot,
      ...asset.metadata,
    }),
    tags: normalizeTags(asset.tags),
  });
}
