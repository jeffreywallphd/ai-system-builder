import { z } from "zod";
import type { CanonicalRecordValue } from "../dataset-studio/CanonicalDataShapes";

export const WorkflowOutputBindingContractVersion = "1.0.0";

export const WorkflowOutputTargetTypes = Object.freeze({
  outputDataset: "output-dataset",
  historyDataset: "history-dataset",
  comparisonDataset: "comparison-dataset",
});

export type WorkflowOutputTargetType =
  typeof WorkflowOutputTargetTypes[keyof typeof WorkflowOutputTargetTypes] | (string & {});

export const WorkflowOutputBindingIntents = Object.freeze({
  publishCurrentResult: "publish-current-result",
  appendRunHistory: "append-run-history",
  appendComparisonGroup: "append-comparison-group",
});

export type WorkflowOutputBindingIntent =
  typeof WorkflowOutputBindingIntents[keyof typeof WorkflowOutputBindingIntents] | (string & {});

export const WorkflowOutputBindingWriteModes = Object.freeze({
  replace: "replace",
  upsert: "upsert",
  append: "append",
});

export type WorkflowOutputBindingWriteMode =
  typeof WorkflowOutputBindingWriteModes[keyof typeof WorkflowOutputBindingWriteModes] | (string & {});

const canonicalRecordValueSchema: z.ZodType<CanonicalRecordValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(canonicalRecordValueSchema),
  z.record(z.string(), canonicalRecordValueSchema),
]));

const workflowOutputLineageReferenceSchema = z.object({
  workflowAssetId: z.string().trim().min(1),
  workflowAssetVersionId: z.string().trim().min(1).optional(),
  workflowRunId: z.string().trim().min(1),
  sourceImageStableIds: z.array(z.string().trim().min(1)).default([]),
  sourceDatasetAssetId: z.string().trim().min(1).optional(),
  sourceDatasetAssetVersionId: z.string().trim().min(1).optional(),
  sourceDatasetInstanceId: z.string().trim().min(1).optional(),
  sourceRecordIds: z.array(z.string().trim().min(1)).default([]),
  outputGroupId: z.string().trim().min(1).optional(),
  outputIndex: z.number().int().nonnegative().optional(),
  outputRelationship: z.object({
    relationshipType: z.string().trim().min(1),
    direction: z.enum(["produced-to-target", "derived-from-source", "captured-in-history"]).default("produced-to-target"),
    reusable: z.boolean().default(true),
    audit: z.boolean().default(true),
    introspection: z.boolean().default(true),
    metadata: z.record(z.string().trim().min(1), canonicalRecordValueSchema).default({}),
  }).default({
    relationshipType: "workflow-output-binding",
    direction: "produced-to-target",
    reusable: true,
    audit: true,
    introspection: true,
    metadata: {},
  }),
});

const workflowOutputPersistenceMetadataSchema = z.object({
  systemId: z.string().trim().min(1),
  datasetInstanceId: z.string().trim().min(1),
  datasetAssetId: z.string().trim().min(1).optional(),
  datasetAssetVersionId: z.string().trim().min(1).optional(),
  persistedAt: z.string().datetime().optional(),
  durable: z.boolean().default(true),
});

const workflowOutputRecordPayloadSchema = z.object({
  recordId: z.string().trim().min(1).optional(),
  imageAssetRefStableId: z.string().trim().min(1).optional(),
  value: z.record(z.string().trim().min(1), canonicalRecordValueSchema).default({}),
  metadata: z.record(z.string().trim().min(1), canonicalRecordValueSchema).default({}),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export const WorkflowOutputBindingTargetSchema = z.object({
  targetType: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  datasetInstanceId: z.string().trim().min(1).optional(),
  datasetAssetId: z.string().trim().min(1).optional(),
  datasetAssetVersionId: z.string().trim().min(1).optional(),
  groupBy: z.string().trim().min(1).optional(),
  metadata: z.record(z.string().trim().min(1), canonicalRecordValueSchema).default({}),
});

export const WorkflowOutputBindingDescriptorSchema = z.object({
  bindingId: z.string().trim().min(1),
  contractVersion: z.string().trim().min(1).default(WorkflowOutputBindingContractVersion),
  outputId: z.string().trim().min(1),
  intent: z.string().trim().min(1),
  writeMode: z.string().trim().min(1),
  target: WorkflowOutputBindingTargetSchema,
  records: z.array(workflowOutputRecordPayloadSchema).default([]),
  lineage: workflowOutputLineageReferenceSchema,
  persistence: workflowOutputPersistenceMetadataSchema,
});

export type WorkflowOutputBindingTarget = z.infer<typeof WorkflowOutputBindingTargetSchema>;
export type WorkflowOutputRecordPayload = z.infer<typeof workflowOutputRecordPayloadSchema>;
export type WorkflowOutputLineageReference = z.infer<typeof workflowOutputLineageReferenceSchema>;
export type WorkflowOutputPersistenceMetadata = z.infer<typeof workflowOutputPersistenceMetadataSchema>;

export interface WorkflowOutputBindingDescriptor extends Omit<z.infer<typeof WorkflowOutputBindingDescriptorSchema>, "intent" | "writeMode" | "target"> {
  readonly intent: WorkflowOutputBindingIntent;
  readonly writeMode: WorkflowOutputBindingWriteMode;
  readonly target: WorkflowOutputBindingTarget & { readonly targetType: WorkflowOutputTargetType };
}

export function createWorkflowOutputBindingDescriptor(input: unknown): WorkflowOutputBindingDescriptor {
  const parsed = WorkflowOutputBindingDescriptorSchema.parse(input);
  const dedupedTags = parsed.records.map((record) => Object.freeze({
    ...record,
    tags: Object.freeze([...(new Set(record.tags.map((tag) => tag.trim()).filter(Boolean)))]),
  }));
  return Object.freeze({
    ...parsed,
    records: Object.freeze(dedupedTags),
  });
}

export function suggestIntentForTargetType(targetType: WorkflowOutputTargetType): WorkflowOutputBindingIntent {
  if (targetType === WorkflowOutputTargetTypes.outputDataset) {
    return WorkflowOutputBindingIntents.publishCurrentResult;
  }
  if (targetType === WorkflowOutputTargetTypes.historyDataset) {
    return WorkflowOutputBindingIntents.appendRunHistory;
  }
  if (targetType === WorkflowOutputTargetTypes.comparisonDataset) {
    return WorkflowOutputBindingIntents.appendComparisonGroup;
  }
  return WorkflowOutputBindingIntents.publishCurrentResult;
}

export function suggestWriteModeForTargetType(targetType: WorkflowOutputTargetType): WorkflowOutputBindingWriteMode {
  if (targetType === WorkflowOutputTargetTypes.outputDataset) {
    return WorkflowOutputBindingWriteModes.upsert;
  }
  return WorkflowOutputBindingWriteModes.append;
}
