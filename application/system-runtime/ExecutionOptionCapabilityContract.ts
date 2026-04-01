import { z } from "zod";

const positiveIntSchema = z.number().int().positive();
const nonNegativeIntSchema = z.number().int().nonnegative();
const positiveNumberSchema = z.number().positive();

export const RuntimeSeedBehaviorSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("deterministic"),
    value: nonNegativeIntSchema,
  }),
  z.object({
    mode: z.literal("random"),
  }),
]);

export type RuntimeSeedBehavior = z.infer<typeof RuntimeSeedBehaviorSchema>;

export const RuntimeResolutionSchema = z.object({
  width: positiveIntSchema,
  height: positiveIntSchema,
});

export type RuntimeResolution = z.infer<typeof RuntimeResolutionSchema>;

export const RuntimeBatchOptionsSchema = z.object({
  count: positiveIntSchema,
});

export type RuntimeBatchOptions = z.infer<typeof RuntimeBatchOptionsSchema>;

export const RuntimeDevicePreferencesSchema = z.object({
  device: z.enum(["auto", "cpu", "gpu"]),
  precision: z.enum(["auto", "fp16", "bf16", "fp32"]),
});

export type RuntimeDevicePreferences = z.infer<typeof RuntimeDevicePreferencesSchema>;

export const RuntimeExecutionOptionValuesSchema = z.object({
  sampler: z.string().trim().min(1).optional(),
  steps: positiveIntSchema.optional(),
  seed: RuntimeSeedBehaviorSchema.optional(),
  guidanceScale: positiveNumberSchema.optional(),
  resolution: RuntimeResolutionSchema.optional(),
  batch: RuntimeBatchOptionsSchema.optional(),
  runtime: RuntimeDevicePreferencesSchema.optional(),
});

export type RuntimeExecutionOptionValues = z.infer<typeof RuntimeExecutionOptionValuesSchema>;

const RuntimeSamplerCapabilitySchema = z.object({
  required: z.boolean().default(false),
  defaultValue: z.string().trim().min(1).optional(),
  allowedValues: z.array(z.string().trim().min(1)).default([]),
});

const RuntimeNumericCapabilitySchema = z.object({
  required: z.boolean().default(false),
  defaultValue: positiveNumberSchema.optional(),
  minimum: positiveNumberSchema.optional(),
  maximum: positiveNumberSchema.optional(),
}).superRefine((value, context) => {
  if (value.minimum !== undefined && value.maximum !== undefined && value.minimum > value.maximum) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "minimum cannot be greater than maximum." });
  }
  if (value.defaultValue !== undefined && value.minimum !== undefined && value.defaultValue < value.minimum) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "defaultValue cannot be less than minimum." });
  }
  if (value.defaultValue !== undefined && value.maximum !== undefined && value.defaultValue > value.maximum) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "defaultValue cannot be greater than maximum." });
  }
});

const RuntimeResolutionCapabilitySchema = z.object({
  required: z.boolean().default(false),
  defaultValue: RuntimeResolutionSchema.optional(),
  minimumWidth: positiveIntSchema.optional(),
  maximumWidth: positiveIntSchema.optional(),
  minimumHeight: positiveIntSchema.optional(),
  maximumHeight: positiveIntSchema.optional(),
  widthStep: positiveIntSchema.optional(),
  heightStep: positiveIntSchema.optional(),
}).superRefine((value, context) => {
  if (value.minimumWidth !== undefined && value.maximumWidth !== undefined && value.minimumWidth > value.maximumWidth) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "minimumWidth cannot be greater than maximumWidth." });
  }
  if (value.minimumHeight !== undefined && value.maximumHeight !== undefined && value.minimumHeight > value.maximumHeight) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "minimumHeight cannot be greater than maximumHeight." });
  }
});

const RuntimeSeedCapabilitySchema = z.object({
  required: z.boolean().default(false),
  defaultValue: RuntimeSeedBehaviorSchema.optional(),
  allowDeterministic: z.boolean().default(true),
  allowRandom: z.boolean().default(true),
});

const RuntimeDeviceCapabilitySchema = z.object({
  required: z.boolean().default(false),
  defaultValue: RuntimeDevicePreferencesSchema.optional(),
  allowedDevices: z.array(z.enum(["auto", "cpu", "gpu"])) .default(["auto", "cpu", "gpu"]),
  allowedPrecisions: z.array(z.enum(["auto", "fp16", "bf16", "fp32"])) .default(["auto", "fp16", "bf16", "fp32"]),
});

export const ExecutionOptionCapabilityContractSchema = z.object({
  contractVersion: z.string().trim().min(1).default("1.0.0"),
  sampler: RuntimeSamplerCapabilitySchema.default({}),
  steps: RuntimeNumericCapabilitySchema.default({}),
  seed: RuntimeSeedCapabilitySchema.default({}),
  guidanceScale: RuntimeNumericCapabilitySchema.default({}),
  resolution: RuntimeResolutionCapabilitySchema.default({}),
  batch: RuntimeNumericCapabilitySchema.default({}),
  runtime: RuntimeDeviceCapabilitySchema.default({}),
});

export type ExecutionOptionCapabilityContract = z.infer<typeof ExecutionOptionCapabilityContractSchema>;
export type RuntimeExecutionOptionOverride = RuntimeExecutionOptionValues;
export type ResolvedRuntimeExecutionOptions = z.infer<typeof RuntimeExecutionOptionValuesSchema>;

export function validateExecutionOptionCapabilityContract(input: unknown): ExecutionOptionCapabilityContract {
  return ExecutionOptionCapabilityContractSchema.parse(input);
}

export function createExecutionOptionCapabilityContract(input: ExecutionOptionCapabilityContract): ExecutionOptionCapabilityContract {
  const parsed = validateExecutionOptionCapabilityContract(input);
  return Object.freeze({
    ...parsed,
    sampler: Object.freeze({ ...parsed.sampler, allowedValues: Object.freeze([...parsed.sampler.allowedValues]) }),
    steps: Object.freeze({ ...parsed.steps }),
    seed: Object.freeze({ ...parsed.seed, defaultValue: parsed.seed.defaultValue ? Object.freeze({ ...parsed.seed.defaultValue }) : undefined }),
    guidanceScale: Object.freeze({ ...parsed.guidanceScale }),
    resolution: Object.freeze({ ...parsed.resolution, defaultValue: parsed.resolution.defaultValue ? Object.freeze({ ...parsed.resolution.defaultValue }) : undefined }),
    batch: Object.freeze({ ...parsed.batch }),
    runtime: Object.freeze({
      ...parsed.runtime,
      defaultValue: parsed.runtime.defaultValue ? Object.freeze({ ...parsed.runtime.defaultValue }) : undefined,
      allowedDevices: Object.freeze([...parsed.runtime.allowedDevices]),
      allowedPrecisions: Object.freeze([...parsed.runtime.allowedPrecisions]),
    }),
  });
}
