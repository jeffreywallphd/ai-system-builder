import { z } from "zod";
import { StorageBindingAreaSchema, type StorageBindingArea } from "./StorageInstanceProvisioningContract";

export const StorageInstanceLifecycleStates = Object.freeze({
  provisioning: "provisioning",
  ready: "ready",
  archived: "archived",
} as const);
export type StorageInstanceLifecycleState = (typeof StorageInstanceLifecycleStates)[keyof typeof StorageInstanceLifecycleStates];

const StorageInstanceDisplayMetadataSchema = z.object({
  name: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
}).strict();
export type StorageInstanceDisplayMetadata = z.infer<typeof StorageInstanceDisplayMetadataSchema>;

const StorageInstanceLifecycleSchema = z.object({
  state: z.nativeEnum(StorageInstanceLifecycleStates),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),
}).strict();
export type StorageInstanceLifecycle = z.infer<typeof StorageInstanceLifecycleSchema>;

const StorageInstanceBindingMetadataSchema = z.object({
  bindingId: z.string().trim().min(1),
  area: StorageBindingAreaSchema,
  reference: z.string().trim().min(1),
  provider: z.string().trim().min(1),
}).strict();
export type StorageInstanceBindingMetadata = z.infer<typeof StorageInstanceBindingMetadataSchema>;

export const StorageAttachmentOwnerKinds = Object.freeze({
  system: "system",
  embeddedSubsystem: "embedded-subsystem",
} as const);
export type StorageAttachmentOwnerKind = (typeof StorageAttachmentOwnerKinds)[keyof typeof StorageAttachmentOwnerKinds];

const StorageInstanceAttachmentSchema = z.object({
  attachmentId: z.string().trim().min(1),
  ownerKind: z.nativeEnum(StorageAttachmentOwnerKinds),
  ownerId: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
  attachedAt: z.string().datetime(),
}).strict();
export type StorageInstanceAttachment = z.infer<typeof StorageInstanceAttachmentSchema>;

export const StorageInstanceShareabilitySchema = z.object({
  mode: z.enum(["shared", "exclusive"]).default("shared"),
  reusable: z.boolean().default(true),
}).strict();
export type StorageInstanceShareability = z.infer<typeof StorageInstanceShareabilitySchema>;

export const StorageInstanceMetadataSchema = z.object({
  instanceId: z.string().trim().min(1),
  storageInstanceRef: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  contractVersion: z.string().trim().min(1).default("1.0.0"),
  display: StorageInstanceDisplayMetadataSchema.default({ tags: [] }),
  lifecycle: StorageInstanceLifecycleSchema,
  bindings: z.array(StorageInstanceBindingMetadataSchema).min(1),
  shareability: StorageInstanceShareabilitySchema.default({ mode: "shared", reusable: true }),
  attachments: z.array(StorageInstanceAttachmentSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type StorageInstanceMetadata = z.infer<typeof StorageInstanceMetadataSchema>;

export function validateStorageInstanceMetadata(input: unknown): StorageInstanceMetadata {
  return StorageInstanceMetadataSchema.parse(input);
}

export function createStorageInstanceMetadata(input: StorageInstanceMetadata): StorageInstanceMetadata {
  const parsed = validateStorageInstanceMetadata(input);
  return Object.freeze({
    ...parsed,
    display: Object.freeze({
      ...parsed.display,
      tags: Object.freeze([...parsed.display.tags]),
    }),
    lifecycle: Object.freeze({ ...parsed.lifecycle }),
    bindings: Object.freeze(parsed.bindings.map((binding) => Object.freeze({ ...binding }))),
    shareability: Object.freeze({ ...parsed.shareability }),
    attachments: Object.freeze(parsed.attachments.map((attachment) => Object.freeze({ ...attachment }))),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createStorageAttachmentId(input: {
  readonly instanceId: string;
  readonly ownerKind: StorageAttachmentOwnerKind;
  readonly ownerId: string;
  readonly role?: string;
}): string {
  const instanceId = input.instanceId.trim();
  const ownerId = input.ownerId.trim();
  const role = input.role?.trim();
  if (!instanceId || !ownerId) {
    throw new Error("instanceId and ownerId are required.");
  }
  return `storage-attachment:${instanceId}:${input.ownerKind}:${ownerId}:${role ?? "default"}`;
}

export function findStorageBindingReference(
  metadata: StorageInstanceMetadata,
  area: StorageBindingArea,
): string | undefined {
  return metadata.bindings.find((binding) => binding.area === area)?.reference;
}
