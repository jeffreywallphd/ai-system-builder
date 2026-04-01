import { z } from "zod";

const providerIdSchema = z.string().trim().min(1);
const providerKindSchema = z.enum(["image-runtime", "workflow-runtime", "generic-runtime"]);
const lifecycleStatusSchema = z.enum(["available", "degraded", "unavailable"]);

export const RuntimeExecutionProviderSchema = z.object({
  providerId: providerIdSchema,
  providerKind: providerKindSchema,
  providerVersion: z.string().trim().min(1).optional(),
  labels: z.array(z.string().trim().min(1)).default([]),
});

export type RuntimeExecutionProvider = z.infer<typeof RuntimeExecutionProviderSchema>;

export const WorkflowExecutionProfileSchema = z.object({
  profileId: z.string().trim().min(1),
  workflowAssetId: z.string().trim().min(1),
  workflowAssetVersionId: z.string().trim().min(1).optional(),
  executionIntent: z.enum(["image-generation", "image-editing", "image-upscaling", "generic"]),
  requiredCapabilityTags: z.array(z.string().trim().min(1)).default([]),
});

export type WorkflowExecutionProfile = z.infer<typeof WorkflowExecutionProfileSchema>;

export const RuntimeExecutionOptionsSchema = z.object({
  deterministicSeed: z.number().int().nonnegative().optional(),
  batchSize: z.number().int().positive().max(16).optional(),
  timeoutMs: z.number().int().positive().max(60_000 * 60).optional(),
  qualityProfile: z.enum(["draft", "balanced", "quality"]).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type RuntimeExecutionOptions = z.infer<typeof RuntimeExecutionOptionsSchema>;

export const RuntimeCapabilityAvailabilitySchema = z.object({
  status: lifecycleStatusSchema,
  reasonCode: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  missingCapabilities: z.array(z.string().trim().min(1)).default([]),
});

export type RuntimeCapabilityAvailability = z.infer<typeof RuntimeCapabilityAvailabilitySchema>;

export const RuntimeCapabilityBindingContractSchema = z.object({
  bindingId: z.string().trim().min(1),
  systemAssetId: z.string().trim().min(1),
  systemAssetVersionId: z.string().trim().min(1).optional(),
  executionProvider: RuntimeExecutionProviderSchema,
  workflowExecutionProfile: WorkflowExecutionProfileSchema,
  modelBindingId: z.string().trim().min(1),
  executionOptions: RuntimeExecutionOptionsSchema.default({}),
  availability: RuntimeCapabilityAvailabilitySchema,
  contractVersion: z.string().trim().min(1).default("1.0.0"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RuntimeCapabilityBindingContract = z.infer<typeof RuntimeCapabilityBindingContractSchema>;

export function validateRuntimeCapabilityBindingContract(input: unknown): RuntimeCapabilityBindingContract {
  return RuntimeCapabilityBindingContractSchema.parse(input);
}

export function createRuntimeCapabilityBindingContract(input: RuntimeCapabilityBindingContract): RuntimeCapabilityBindingContract {
  const parsed = validateRuntimeCapabilityBindingContract(input);
  return Object.freeze({
    ...parsed,
    executionProvider: Object.freeze({ ...parsed.executionProvider, labels: Object.freeze([...parsed.executionProvider.labels]) }),
    workflowExecutionProfile: Object.freeze({
      ...parsed.workflowExecutionProfile,
      requiredCapabilityTags: Object.freeze([...parsed.workflowExecutionProfile.requiredCapabilityTags]),
    }),
    executionOptions: Object.freeze({ ...parsed.executionOptions, tags: Object.freeze([...parsed.executionOptions.tags]) }),
    availability: Object.freeze({ ...parsed.availability, missingCapabilities: Object.freeze([...parsed.availability.missingCapabilities]) }),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function evaluateRuntimeCapabilityAvailability(input: {
  readonly requiredCapabilities: ReadonlyArray<string>;
  readonly providerCapabilities: ReadonlyArray<string>;
}): RuntimeCapabilityAvailability {
  const required = new Set(input.requiredCapabilities.map((entry) => entry.trim()).filter(Boolean));
  const supported = new Set(input.providerCapabilities.map((entry) => entry.trim()).filter(Boolean));
  const missing = [...required].filter((entry) => !supported.has(entry));
  if (missing.length === 0) {
    return Object.freeze({ status: "available" as const, missingCapabilities: Object.freeze([]) });
  }
  return Object.freeze({
    status: "unavailable" as const,
    reasonCode: "missing-runtime-capability",
    message: "Execution provider is missing required workflow capabilities.",
    missingCapabilities: Object.freeze(missing),
  });
}
