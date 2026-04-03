import { z } from "zod";
import type { ImageWorkflowAssetContract, ImageWorkflowAssetIntentType } from "./ImageWorkflowAssetContract";
import type { ImageWorkflowComposition } from "./ImageWorkflowComposition";

export const ImageWorkflowAssetPreviewSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  workflowType: z.string().trim().min(1),
  intentType: z.string().trim().min(1),
  inputSummary: z.array(z.object({
    fieldId: z.string().trim().min(1),
    required: z.boolean(),
    allowsMultiple: z.boolean(),
    description: z.string().trim().min(1),
  })).min(1),
  outputSummary: z.array(z.object({
    fieldId: z.string().trim().min(1),
    required: z.boolean(),
    allowsMultiple: z.boolean(),
    description: z.string().trim().min(1),
  })).min(1),
  boundedConfigurationSummary: z.array(z.object({
    fieldId: z.string().trim().min(1),
    valueType: z.string().trim().min(1),
    required: z.boolean(),
    defaultValue: z.unknown().optional(),
  })),
  compositionSummary: z.object({
    stageCount: z.number().int().positive(),
    stageIds: z.array(z.string().trim().min(1)).min(1),
    inspectableStageIds: z.array(z.string().trim().min(1)),
    adapterBoundary: z.object({
      adapterId: z.string().trim().min(1),
      adapterContractVersion: z.string().trim().min(1),
    }),
  }),
  inspectableFields: z.array(z.string().trim().min(1)).min(1),
  inspectableStageIds: z.array(z.string().trim().min(1)).min(1),
});

export type ImageWorkflowAssetPreview = z.infer<typeof ImageWorkflowAssetPreviewSchema>;

export function createImageWorkflowAssetPreview(input: {
  readonly title: string;
  readonly summary: string;
  readonly workflowType: string;
  readonly intentType: ImageWorkflowAssetIntentType;
  readonly contract: ImageWorkflowAssetContract;
  readonly composition: ImageWorkflowComposition;
}): ImageWorkflowAssetPreview {
  return ImageWorkflowAssetPreviewSchema.parse({
    title: input.title,
    summary: input.summary,
    workflowType: input.workflowType,
    intentType: input.intentType,
    inputSummary: input.contract.input.fields.map((field) => ({
      fieldId: field.id,
      required: field.required,
      allowsMultiple: field.allowsMultiple,
      description: field.description,
    })),
    outputSummary: input.contract.output.fields.map((field) => ({
      fieldId: field.id,
      required: field.required,
      allowsMultiple: field.allowsMultiple,
      description: field.description,
    })),
    boundedConfigurationSummary: input.contract.config.fields.map((field) => ({
      fieldId: field.id,
      valueType: field.valueType,
      required: field.required,
      defaultValue: field.defaultValue,
    })),
    compositionSummary: {
      stageCount: input.composition.stages.length,
      stageIds: input.composition.stages.map((stage) => stage.id),
      inspectableStageIds: input.composition.metadata.preview.inspectableStageIds,
      adapterBoundary: {
        adapterId: input.composition.adapterBoundary.adapterId,
        adapterContractVersion: input.composition.adapterBoundary.adapterContractVersion,
      },
    },
    inspectableFields: input.contract.preview.inspectableFields,
    inspectableStageIds: input.composition.metadata.preview.inspectableStageIds,
  });
}
