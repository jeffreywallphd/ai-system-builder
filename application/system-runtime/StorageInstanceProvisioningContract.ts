import { z } from "zod";

const StorageBindingAreaSchema = z.enum(["input", "output", "intermediate"]);
export type StorageBindingArea = z.infer<typeof StorageBindingAreaSchema>;

export const StorageInstanceProvisioningRequestSchema = z.object({
  instanceId: z.string().trim().min(1),
  requestedBindings: z.array(StorageBindingAreaSchema).min(1).default(["input", "output"]),
  reuseExisting: z.boolean().default(true),
  contractVersion: z.string().trim().min(1).default("1.0.0"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type StorageInstanceProvisioningRequest = z.infer<typeof StorageInstanceProvisioningRequestSchema>;

export const StorageLogicalBindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  area: StorageBindingAreaSchema,
  reference: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type StorageLogicalBinding = z.infer<typeof StorageLogicalBindingSchema>;

export const StorageInstanceProvisioningResultSchema = z.object({
  instanceId: z.string().trim().min(1),
  storageInstanceRef: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  contractVersion: z.string().trim().min(1).default("1.0.0"),
  bindings: z.array(StorageLogicalBindingSchema),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type StorageInstanceProvisioningResult = z.infer<typeof StorageInstanceProvisioningResultSchema>;

export interface StorageInstanceProvisioningContract {
  provision(request: StorageInstanceProvisioningRequest): Promise<StorageInstanceProvisioningResult>;
}

export function validateStorageInstanceProvisioningRequest(input: unknown): StorageInstanceProvisioningRequest {
  return StorageInstanceProvisioningRequestSchema.parse(input);
}

export function validateStorageInstanceProvisioningResult(input: unknown): StorageInstanceProvisioningResult {
  return StorageInstanceProvisioningResultSchema.parse(input);
}

export function createStorageInstanceProvisioningRequest(input: StorageInstanceProvisioningRequest): StorageInstanceProvisioningRequest {
  const parsed = validateStorageInstanceProvisioningRequest(input);
  const dedupedBindings = Object.freeze([...new Set(parsed.requestedBindings)]);
  return Object.freeze({
    ...parsed,
    requestedBindings: dedupedBindings,
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createStorageInstanceProvisioningResult(input: StorageInstanceProvisioningResult): StorageInstanceProvisioningResult {
  const parsed = validateStorageInstanceProvisioningResult(input);
  return Object.freeze({
    ...parsed,
    bindings: Object.freeze(parsed.bindings.map((binding) => Object.freeze({
      ...binding,
      metadata: Object.freeze({ ...binding.metadata }),
    }))),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createStorageLogicalReference(instanceId: string, area: StorageBindingArea): string {
  const normalizedInstanceId = instanceId.trim();
  if (!normalizedInstanceId) {
    throw new Error("instanceId is required.");
  }
  return `storage-instance://${encodeURIComponent(normalizedInstanceId)}/${area}`;
}
