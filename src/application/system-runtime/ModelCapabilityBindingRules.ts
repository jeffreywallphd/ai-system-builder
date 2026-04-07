import { z } from "zod";

const modelBindingStatusSchema = z.enum(["bound", "missing", "incompatible"]);

export const ModelCapabilityDescriptorSchema = z.object({
  descriptorId: z.string().trim().min(1),
  modelAssetId: z.string().trim().min(1),
  modelAssetVersionId: z.string().trim().min(1).optional(),
  supportedExecutionProfiles: z.array(z.string().trim().min(1)).default([]),
  supportedExecutionProviders: z.array(z.string().trim().min(1)).default([]),
  defaultPriority: z.number().int().nonnegative().default(100),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type ModelCapabilityDescriptor = z.infer<typeof ModelCapabilityDescriptorSchema>;

export const AllowedModelBindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  descriptorId: z.string().trim().min(1),
  required: z.boolean().default(false),
  defaultForProfiles: z.array(z.string().trim().min(1)).default([]),
});

export type AllowedModelBinding = z.infer<typeof AllowedModelBindingSchema>;

export const ModelCapabilityBindingPolicySchema = z.object({
  policyId: z.string().trim().min(1),
  allowedBindings: z.array(AllowedModelBindingSchema).min(1),
  defaultBindingId: z.string().trim().min(1).optional(),
});

export type ModelCapabilityBindingPolicy = z.infer<typeof ModelCapabilityBindingPolicySchema>;

export interface ResolveModelCapabilityBindingRequest {
  readonly policy: ModelCapabilityBindingPolicy;
  readonly descriptors: ReadonlyArray<ModelCapabilityDescriptor>;
  readonly executionProfileId: string;
  readonly executionProviderId: string;
  readonly requestedBindingId?: string;
}

export interface ResolveModelCapabilityBindingResult {
  readonly status: z.infer<typeof modelBindingStatusSchema>;
  readonly bindingId?: string;
  readonly descriptorId?: string;
  readonly code?: "binding-not-allowed" | "descriptor-missing" | "model-incompatible" | "default-missing";
  readonly message?: string;
}

function supportsExecutionContext(input: {
  readonly descriptor: ModelCapabilityDescriptor;
  readonly executionProfileId: string;
  readonly executionProviderId: string;
}): boolean {
  const supportsProfile =
    input.descriptor.supportedExecutionProfiles.length === 0
    || input.descriptor.supportedExecutionProfiles.includes(input.executionProfileId);
  if (!supportsProfile) {
    return false;
  }
  return (
    input.descriptor.supportedExecutionProviders.length === 0
    || input.descriptor.supportedExecutionProviders.includes(input.executionProviderId)
  );
}

function resolveDefaultBindingId(input: {
  readonly policy: ModelCapabilityBindingPolicy;
  readonly executionProfileId: string;
}): string | undefined {
  const profileDefault = input.policy.allowedBindings.find((entry) => entry.defaultForProfiles.includes(input.executionProfileId));
  return profileDefault?.bindingId ?? input.policy.defaultBindingId;
}

export function resolveModelCapabilityBinding(request: ResolveModelCapabilityBindingRequest): ResolveModelCapabilityBindingResult {
  const policy = ModelCapabilityBindingPolicySchema.parse(request.policy);
  const descriptors = request.descriptors.map((entry) => ModelCapabilityDescriptorSchema.parse(entry));
  const descriptorById = new Map(descriptors.map((entry) => [entry.descriptorId, entry] as const));

  const selectedBindingId = request.requestedBindingId?.trim() || resolveDefaultBindingId({
    policy,
    executionProfileId: request.executionProfileId,
  });

  if (!selectedBindingId) {
    return Object.freeze({
      status: "missing",
      code: "default-missing",
      message: "No requested model binding was provided and no default binding is configured.",
    });
  }

  const allowedBinding = policy.allowedBindings.find((entry) => entry.bindingId === selectedBindingId);
  if (!allowedBinding) {
    return Object.freeze({
      status: "missing",
      code: "binding-not-allowed",
      message: `Binding '${selectedBindingId}' is not allowed by policy '${policy.policyId}'.`,
    });
  }

  const descriptor = descriptorById.get(allowedBinding.descriptorId);
  if (!descriptor) {
    return Object.freeze({
      status: "missing",
      bindingId: allowedBinding.bindingId,
      descriptorId: allowedBinding.descriptorId,
      code: "descriptor-missing",
      message: `Descriptor '${allowedBinding.descriptorId}' is missing for binding '${allowedBinding.bindingId}'.`,
    });
  }

  if (!supportsExecutionContext({
    descriptor,
    executionProfileId: request.executionProfileId,
    executionProviderId: request.executionProviderId,
  })) {
    return Object.freeze({
      status: "incompatible",
      bindingId: allowedBinding.bindingId,
      descriptorId: descriptor.descriptorId,
      code: "model-incompatible",
      message: `Binding '${allowedBinding.bindingId}' is incompatible with execution profile/provider constraints.`,
    });
  }

  return Object.freeze({
    status: "bound",
    bindingId: allowedBinding.bindingId,
    descriptorId: descriptor.descriptorId,
  });
}
