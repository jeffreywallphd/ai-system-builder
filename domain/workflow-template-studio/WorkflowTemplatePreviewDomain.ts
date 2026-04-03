import { z } from "zod";

export const WorkflowTemplatePreviewSchema = z.object({
  templateId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1),
  supportedIntent: z.string().trim().min(1),
  expectedInputs: z.array(z.object({
    inputId: z.string().trim().min(1),
    type: z.enum(["text", "image", "mask", "number", "boolean", "json"]),
    required: z.boolean(),
    description: z.string().trim().min(1).optional(),
  })),
  outputs: z.array(z.object({
    outputId: z.string().trim().min(1),
    type: z.enum(["image", "images", "json"]),
    description: z.string().trim().min(1).optional(),
    targetDatasetAssetId: z.string().trim().min(1).optional(),
    targetDatasetInstanceRef: z.string().trim().min(1).optional(),
    targetStorageInstanceRef: z.string().trim().min(1).optional(),
    targetStorageBindingId: z.string().trim().min(1).optional(),
  })),
  parameters: z.array(z.object({
    parameterId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    type: z.enum(["string", "number", "integer", "boolean", "json", "enum"]),
    required: z.boolean(),
    defaultValue: z.unknown().optional(),
  })),
  referencedWorkflowAssets: z.array(z.object({
    workflowAssetId: z.string().trim().min(1),
    workflowAssetVersionId: z.string().trim().min(1).optional(),
  })).min(1),
  executionMetadata: z.object({
    runtimeProfile: z.enum(["comfyui", "interpreted", "python-delegated"]),
    backendId: z.string().trim().min(1),
    requiredCapabilities: z.array(z.string().trim().min(1)).min(1),
    requiredDependencies: z.array(z.string().trim().min(1)).min(1),
    workflowMode: z.enum(["image-to-image", "text-to-image", "upscaling"]),
    supportsFaceId: z.boolean(),
    supportsBatchExecution: z.boolean(),
  }).optional(),
});

export type WorkflowTemplatePreview = z.infer<typeof WorkflowTemplatePreviewSchema>;

export function createWorkflowTemplatePreview(input: WorkflowTemplatePreview): WorkflowTemplatePreview {
  return Object.freeze(WorkflowTemplatePreviewSchema.parse(input));
}
