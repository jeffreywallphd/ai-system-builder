import { z } from "zod";
import { WorkflowInputBindingSourceKinds } from "@domain/workflow-studio/WorkflowInputBindingDomain";
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
import {
  createImageWorkflowOutputBindingConfiguration,
  type ImageWorkflowOutputBindingConfiguration,
} from "./ImageWorkflowOutputBindingConfiguration";
import {
  createImageWorkflowUiTriggerBindingConfiguration,
  type ImageWorkflowUiTriggerBindingConfiguration,
} from "./ImageWorkflowUiTriggerBindingConfiguration";

export const BatchTransformWorkflowAssetId = "image-workflow.batch-transform";
export const BatchTransformWorkflowAssetVersion = "1.0.0";

export const BatchTransformWorkflowAssetConfigSchema = z.object({
  concurrency: z.number().int().min(1).max(12).default(4),
  onItemFailure: z.enum(["continue", "halt"]).default("continue"),
  groupOutputsBy: z.enum(["input-order", "source-group"]).default("input-order"),
  resultCountPerItem: z.number().int().min(1).max(4).default(1),
});

export type BatchTransformWorkflowAssetConfig = z.infer<typeof BatchTransformWorkflowAssetConfigSchema>;

export const BatchTransformBatchItemSchema = z.object({
  itemId: z.string().trim().min(1),
  sourceImage: z.object({
    assetId: z.string().trim().min(1),
    versionId: z.string().trim().min(1).optional(),
    kind: z.enum(["direct-image", "dataset-image-entry"]).default("direct-image"),
    datasetRef: z.object({
      datasetAssetId: z.string().trim().min(1),
      datasetVersionId: z.string().trim().min(1).optional(),
      recordId: z.string().trim().min(1).optional(),
    }).optional(),
  }),
  sourceGroupId: z.string().trim().min(1).optional(),
});

export type BatchTransformBatchItem = z.infer<typeof BatchTransformBatchItemSchema>;

export interface BatchTransformWorkflowAsset {
  readonly id: typeof BatchTransformWorkflowAssetId;
  readonly version: typeof BatchTransformWorkflowAssetVersion;
  readonly intentType: typeof ImageWorkflowAssetIntentTypes.batchTransform;
  readonly contract: ImageWorkflowAssetContract;
  readonly configuration: BatchTransformWorkflowAssetConfig;
  readonly composition: ImageWorkflowComposition;
  readonly inputBindings: ImageWorkflowInputBindingConfiguration;
  readonly outputBindings: ImageWorkflowOutputBindingConfiguration;
  readonly uiTriggerBindings: ImageWorkflowUiTriggerBindingConfiguration;
  readonly bindings: Readonly<{
    readonly batchItemsFieldId: "batchItems";
    readonly instructionFieldId: "instruction";
    readonly outputImagesFieldId: "images";
    readonly outputSummaryFieldId: "batchSummary";
  }>;
  readonly outputMapping: Readonly<{
    readonly mode: "per-item";
    readonly itemKeyField: "itemId";
    readonly sourceRefField: "sourceImage";
    readonly outputImagesField: "images";
    readonly statusField: "status";
    readonly lineageField: "lineage";
  }>;
  readonly preview: ImageWorkflowAssetPreview;
}

function buildDefaultOutputBindings(): ImageWorkflowOutputBindingConfiguration {
  return createImageWorkflowOutputBindingConfiguration({
    bindings: [
      { bindingId: "binding.output.primary", outputId: "images", targetType: "output-dataset", targetId: "workflow-output", writeMode: "upsert", defaultTags: ["output"] },
      { bindingId: "binding.output.history", outputId: "images", targetType: "history-dataset", targetId: "workflow-output-history", writeMode: "append", defaultTags: ["history"] },
      { bindingId: "binding.output.comparison", outputId: "images", targetType: "comparison-dataset", targetId: "workflow-output-comparison", writeMode: "append", groupBy: "comparison:batchtransform", defaultTags: ["comparison"] },
    ],
  });
}

function buildBatchTransformComposition(): ImageWorkflowComposition {
  return createReusableImagePipeline({
    compositionId: `${BatchTransformWorkflowAssetId}.pipeline.default`,
    intentType: ImageWorkflowAssetIntentTypes.batchTransform,
    previewMode: "gallery",
    tags: ["image-workflow", "batch-transform", "dataset-compatible"],
    inputBindings: [
      { id: "binding.batch-items", fieldId: "batchItems", source: "input", required: true, description: "Canonical batch item list with direct and dataset-backed references." },
      { id: "binding.instruction", fieldId: "instruction", source: "input", required: false, description: "Shared transform instruction across all batch members." },
      { id: "binding.concurrency", fieldId: "concurrency", source: "config", required: false, description: "Bounded execution concurrency." },
      { id: "binding.on-item-failure", fieldId: "onItemFailure", source: "config", required: false, description: "Failure strategy for batch items." },
      { id: "binding.group-outputs-by", fieldId: "groupOutputsBy", source: "config", required: false, description: "Grouping strategy for output mapping." },
      { id: "binding.result-count-per-item", fieldId: "resultCountPerItem", source: "config", required: false, description: "Bounded output count per batch item." },
    ],
    outputBindings: [
      { id: "binding.output-images", fieldId: "images", source: "system", required: true, description: "Canonical transformed output references." },
      { id: "binding.output-summary", fieldId: "batchSummary", source: "system", required: true, description: "Per-item run status and bounded traceability metadata." },
    ],
    stages: [
      {
        id: "stage.bind-inputs",
        kind: ImageWorkflowCompositionStageKinds.bindInputs,
        title: "Bind batch input set",
        description: "Validate and normalize direct and dataset-backed batch item references.",
        steps: [
          { id: "step.load-batch-images", title: "Load batch source images", nodeKind: "load-image", consumes: ["batchItems"], produces: ["batchImageBuffers"] },
        ],
      },
      {
        id: "stage.prepare-conditioning",
        kind: ImageWorkflowCompositionStageKinds.prepareConditioning,
        title: "Prepare shared conditioning",
        description: "Build one shared transform instruction profile for all batch members.",
        steps: [
          { id: "step.batch-prompt-conditioning", title: "Prepare shared prompt", nodeKind: "prompt-input", consumes: ["instruction"], produces: ["batchPromptConditioning"] },
          { id: "step.batch-vae-encode", title: "Encode batch source images", nodeKind: "vae-encode", consumes: ["batchImageBuffers"], produces: ["batchSourceLatents"] },
        ],
      },
      {
        id: "stage.transform",
        kind: ImageWorkflowCompositionStageKinds.transform,
        title: "Apply batch transform",
        description: "Apply one bounded transform policy across the batch with item-level outputs.",
        steps: [
          {
            id: "step.batch-sampler",
            title: "Sample transformed latents",
            nodeKind: "sampler-wrapper",
            consumes: ["batchSourceLatents", "batchPromptConditioning"],
            produces: ["batchResultLatents"],
            configBindings: [
              { configFieldId: "concurrency", targetKey: "concurrency" },
              { configFieldId: "onItemFailure", targetKey: "onItemFailure" },
              { configFieldId: "resultCountPerItem", targetKey: "batchSize" },
            ],
          },
          { id: "step.batch-decode", title: "Decode transformed latents", nodeKind: "vae-decode", consumes: ["batchResultLatents"], produces: ["batchResultImageBuffers"] },
        ],
      },
      {
        id: "stage.materialize-output",
        kind: ImageWorkflowCompositionStageKinds.materializeOutput,
        title: "Materialize per-item outputs",
        description: "Persist transformed images and map per-item lineage summary records.",
        steps: [
          { id: "step.batch-save-image", title: "Persist transformed images", nodeKind: "save-image", consumes: ["batchResultImageBuffers"], produces: ["images"] },
        ],
      },
    ],
  });
}

function buildDefaultUiTriggerBindings(): ImageWorkflowUiTriggerBindingConfiguration {
  return createImageWorkflowUiTriggerBindingConfiguration({
    bindings: [
      {
        bindingId: "binding.ui.gallery.open",
        event: { kind: "click", sourceComponentId: "output-gallery", actionId: "open-image", eventName: "ui.image.gallery.open" },
        target: { triggerType: "button-click" },
      },
      {
        bindingId: "binding.ui.parameter.submit",
        event: { kind: "submit", sourceComponentId: "parameter-form", actionId: "submit", eventName: "ui.image.parameter.submit" },
        target: { triggerType: "user-initiated-run" },
      },
      {
        bindingId: "binding.ui.selection.changed",
        event: { kind: "selection", sourceComponentId: "output-gallery", actionId: "select-image", eventName: "ui.image.selection.changed" },
        target: { triggerType: "user-initiated-run" },
      },
    ],
  });
}

export function createBatchTransformWorkflowAsset(input?: {
  readonly configuration?: unknown;
  readonly inputBindings?: ImageWorkflowInputBindingConfiguration["bindings"];
  readonly outputBindings?: unknown;
  readonly uiTriggerBindings?: unknown;
}): BatchTransformWorkflowAsset {
  const contract = CoreImageWorkflowAssetTypeContracts[ImageWorkflowAssetIntentTypes.batchTransform];
  const configuration = BatchTransformWorkflowAssetConfigSchema.parse(input?.configuration ?? {});
  const composition = buildBatchTransformComposition();
  const inputBindings = createImageWorkflowInputBindingConfiguration({
    bindings: input?.inputBindings ?? [
      {
        bindingId: "binding.input.batchItems",
        inputId: "batchItems",
        required: true,
        valueType: "array",
        sources: [
          { sourceId: "form-batch-items", kind: WorkflowInputBindingSourceKinds.uiFormValue, formKey: "batchItems", priority: 1, required: true },
          { sourceId: "dataset-collection", kind: WorkflowInputBindingSourceKinds.datasetInstanceReference, purpose: "batch-input", priority: 2, resolution: { shape: "collection" } },
        ],
      },
      {
        bindingId: "binding.input.instruction",
        inputId: "instruction",
        required: false,
        valueType: "string",
        defaultValue: "",
        sources: [
          { sourceId: "form-instruction", kind: WorkflowInputBindingSourceKinds.uiFormValue, formKey: "instruction", priority: 1 },
          { sourceId: "default-instruction", kind: WorkflowInputBindingSourceKinds.constantValue, value: "", priority: 2 },
        ],
      },
    ],
  });

  const outputBindings = createImageWorkflowOutputBindingConfiguration(input?.outputBindings ?? buildDefaultOutputBindings());
  const uiTriggerBindings = createImageWorkflowUiTriggerBindingConfiguration(input?.uiTriggerBindings ?? buildDefaultUiTriggerBindings());

  return Object.freeze({
    id: BatchTransformWorkflowAssetId,
    version: BatchTransformWorkflowAssetVersion,
    intentType: ImageWorkflowAssetIntentTypes.batchTransform,
    contract,
    configuration,
    composition,
    inputBindings,
    outputBindings,
    uiTriggerBindings,
    bindings: Object.freeze({
      batchItemsFieldId: "batchItems",
      instructionFieldId: "instruction",
      outputImagesFieldId: "images",
      outputSummaryFieldId: "batchSummary",
    }),
    outputMapping: Object.freeze({
      mode: "per-item",
      itemKeyField: "itemId",
      sourceRefField: "sourceImage",
      outputImagesField: "images",
      statusField: "status",
      lineageField: "lineage",
    }),
    preview: createImageWorkflowAssetPreview({
      title: "Batch transform",
      summary: "Applies one shared transform policy across direct and dataset-backed image batches.",
      workflowType: "image-workflow",
      intentType: ImageWorkflowAssetIntentTypes.batchTransform,
      contract,
      composition,
    }),
  });
}

