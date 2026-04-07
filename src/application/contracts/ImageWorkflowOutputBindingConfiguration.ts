import { z } from "zod";
import {
  WorkflowOutputBindingIntents,
  WorkflowOutputBindingWriteModes,
  WorkflowOutputTargetTypes,
  createWorkflowOutputBindingDescriptor,
  suggestIntentForTargetType,
  suggestWriteModeForTargetType,
  type WorkflowOutputBindingDescriptor,
  type WorkflowOutputTargetType,
} from "@domain/workflow-studio/WorkflowOutputBindingDomain";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";

const canonicalRecordValueSchema: z.ZodType<CanonicalRecordValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(canonicalRecordValueSchema),
  z.record(z.string(), canonicalRecordValueSchema),
]));

export const ImageWorkflowOutputBindingConfigurationVersion = "1.0.0";

export const ImageWorkflowOutputBindingDeclarationSchema = z.object({
  bindingId: z.string().trim().min(1),
  outputId: z.string().trim().min(1),
  targetType: z.string().trim().min(1),
  writeMode: z.string().trim().min(1).optional(),
  intent: z.string().trim().min(1).optional(),
  targetId: z.string().trim().min(1),
  datasetInstanceId: z.string().trim().min(1).optional(),
  datasetAssetId: z.string().trim().min(1).optional(),
  datasetAssetVersionId: z.string().trim().min(1).optional(),
  groupBy: z.string().trim().min(1).optional(),
  targetMetadata: z.record(z.string().trim().min(1), canonicalRecordValueSchema).default({}),
  defaultRecordMetadata: z.record(z.string().trim().min(1), canonicalRecordValueSchema).default({}),
  defaultTags: z.array(z.string().trim().min(1)).default([]),
});

export const ImageWorkflowOutputBindingConfigurationSchema = z.object({
  configVersion: z.string().trim().min(1).default(ImageWorkflowOutputBindingConfigurationVersion),
  bindings: z.array(ImageWorkflowOutputBindingDeclarationSchema).min(1),
});

export type ImageWorkflowOutputBindingDeclaration = z.infer<typeof ImageWorkflowOutputBindingDeclarationSchema>;
export type ImageWorkflowOutputBindingConfiguration = z.infer<typeof ImageWorkflowOutputBindingConfigurationSchema>;

export function createImageWorkflowOutputBindingConfiguration(input: unknown): ImageWorkflowOutputBindingConfiguration {
  const parsed = ImageWorkflowOutputBindingConfigurationSchema.parse(input);
  return Object.freeze({
    ...parsed,
    bindings: Object.freeze(parsed.bindings.map((binding) => Object.freeze({
      ...binding,
      targetMetadata: Object.freeze({ ...binding.targetMetadata }),
      defaultRecordMetadata: Object.freeze({ ...binding.defaultRecordMetadata }),
      defaultTags: Object.freeze([...(new Set(binding.defaultTags.map((tag) => tag.trim()).filter(Boolean)))]),
    }))),
  });
}

export function createWorkflowOutputBindingDescriptorsFromAssetConfiguration(input: {
  readonly configuration: ImageWorkflowOutputBindingConfiguration;
  readonly workflowRun: {
    readonly workflowAssetId: string;
    readonly workflowAssetVersionId?: string;
    readonly workflowRunId: string;
  };
  readonly persistence: {
    readonly systemId: string;
  };
  readonly sourceContext?: {
    readonly sourceImageStableIds?: ReadonlyArray<string>;
    readonly sourceDatasetAssetId?: string;
    readonly sourceDatasetAssetVersionId?: string;
    readonly sourceDatasetInstanceId?: string;
    readonly sourceRecordIds?: ReadonlyArray<string>;
    readonly handoffId?: string;
    readonly traceId?: string;
    readonly workflowBindingId?: string;
    readonly sourceStudioType?: string;
    readonly sourceStudioId?: string;
  };
}): ReadonlyArray<WorkflowOutputBindingDescriptor> {
  const traceMetadata = Object.fromEntries(
    Object.entries({
      handoffId: input.sourceContext?.handoffId,
      traceId: input.sourceContext?.traceId,
      workflowBindingId: input.sourceContext?.workflowBindingId,
      sourceStudioType: input.sourceContext?.sourceStudioType,
      sourceStudioId: input.sourceContext?.sourceStudioId,
    }).filter(([, value]) => value !== undefined),
  ) as Readonly<Record<string, CanonicalRecordValue>>;

  return Object.freeze(input.configuration.bindings.map((binding) => {
    const targetType = binding.targetType as WorkflowOutputTargetType;
    const intent = binding.intent ?? suggestIntentForTargetType(targetType);
    const writeMode = binding.writeMode ?? suggestWriteModeForTargetType(targetType);

    return createWorkflowOutputBindingDescriptor({
      bindingId: binding.bindingId,
      outputId: binding.outputId,
      intent,
      writeMode,
      target: {
        targetType,
        targetId: binding.targetId,
        datasetInstanceId: binding.datasetInstanceId,
        datasetAssetId: binding.datasetAssetId,
        datasetAssetVersionId: binding.datasetAssetVersionId,
        groupBy: binding.groupBy,
        metadata: binding.targetMetadata,
      },
      records: [{
        metadata: binding.defaultRecordMetadata,
        tags: binding.defaultTags,
        value: {},
      }],
      lineage: {
        workflowAssetId: input.workflowRun.workflowAssetId,
        workflowAssetVersionId: input.workflowRun.workflowAssetVersionId,
        workflowRunId: input.workflowRun.workflowRunId,
        sourceImageStableIds: [...(input.sourceContext?.sourceImageStableIds ?? [])],
        sourceDatasetAssetId: input.sourceContext?.sourceDatasetAssetId,
        sourceDatasetAssetVersionId: input.sourceContext?.sourceDatasetAssetVersionId,
        sourceDatasetInstanceId: input.sourceContext?.sourceDatasetInstanceId,
        sourceRecordIds: [...(input.sourceContext?.sourceRecordIds ?? [])],
        outputRelationship: {
          relationshipType: "workflow-output-binding",
          direction: "produced-to-target",
          metadata: Object.freeze(traceMetadata),
        },
      },
      persistence: {
        systemId: input.persistence.systemId,
        datasetInstanceId: binding.datasetInstanceId ?? binding.targetId,
        datasetAssetId: binding.datasetAssetId,
        datasetAssetVersionId: binding.datasetAssetVersionId,
      },
    });
  }));
}

export const ImageWorkflowBindingDefaults = Object.freeze({
  outputDataset: Object.freeze({
    targetType: WorkflowOutputTargetTypes.outputDataset,
    intent: WorkflowOutputBindingIntents.publishCurrentResult,
    writeMode: WorkflowOutputBindingWriteModes.upsert,
  }),
  historyDataset: Object.freeze({
    targetType: WorkflowOutputTargetTypes.historyDataset,
    intent: WorkflowOutputBindingIntents.appendRunHistory,
    writeMode: WorkflowOutputBindingWriteModes.append,
  }),
  comparisonDataset: Object.freeze({
    targetType: WorkflowOutputTargetTypes.comparisonDataset,
    intent: WorkflowOutputBindingIntents.appendComparisonGroup,
    writeMode: WorkflowOutputBindingWriteModes.append,
  }),
});

