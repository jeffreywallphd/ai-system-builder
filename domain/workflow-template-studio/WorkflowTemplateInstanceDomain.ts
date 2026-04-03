import { z } from "zod";

export const WorkflowTemplateInstanceSchema = z.object({
  instanceId: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  template: z.object({
    templateId: z.string().trim().min(1),
    versionId: z.string().trim().min(1),
  }),
  resolvedWorkflowReferences: z.array(z.object({
    workflowAssetId: z.string().trim().min(1),
    workflowAssetVersionId: z.string().trim().min(1).optional(),
  })).min(1),
  boundInputs: z.array(z.object({
    templateInputId: z.string().trim().min(1),
    valueType: z.enum(["text", "image", "mask", "number", "boolean", "json"]),
    required: z.boolean(),
    value: z.unknown().optional(),
  })),
  boundOutputs: z.array(z.object({
    templateOutputId: z.string().trim().min(1),
    valueType: z.enum(["image", "images", "json"]),
    bindings: z.array(z.object({
      bindingId: z.string().trim().min(1),
      workflowAssetId: z.string().trim().min(1),
      workflowOutputId: z.string().trim().min(1),
      targetDatasetAssetId: z.string().trim().min(1).optional(),
      targetDatasetVersionId: z.string().trim().min(1).optional(),
    })),
  })),
  resolvedParameters: z.record(z.string(), z.unknown()),
  parameterOverrides: z.record(z.string(), z.unknown()),
  workflowParameterBindings: z.array(z.object({
    parameterId: z.string().trim().min(1),
    workflowAssetId: z.string().trim().min(1),
    workflowParameterId: z.string().trim().min(1),
    value: z.unknown().optional(),
  })),
  systemContextBindings: z.array(z.object({
    mappingId: z.string().trim().min(1),
    contextKey: z.string().trim().min(1),
    workflowAssetId: z.string().trim().min(1),
    targetKind: z.enum(["workflow-input", "workflow-parameter"]),
    targetId: z.string().trim().min(1),
    value: z.unknown().optional(),
  })),
});

export type WorkflowTemplateInstance = z.infer<typeof WorkflowTemplateInstanceSchema>;

export function createWorkflowTemplateInstance(input: WorkflowTemplateInstance): WorkflowTemplateInstance {
  return Object.freeze(WorkflowTemplateInstanceSchema.parse(input));
}
