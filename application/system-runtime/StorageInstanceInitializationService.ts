import { z } from "zod";
import {
  createStorageInstanceProvisioningRequest,
  type StorageBindingArea,
  type StorageInstanceProvisioningContract,
  type StorageInstanceProvisioningResult,
} from "./StorageInstanceProvisioningContract";
import {
  StorageAttachmentOwnerKinds,
  StorageInstanceLifecycleStates,
  createStorageAttachmentId,
  createStorageInstanceMetadata,
  type StorageAttachmentOwnerKind,
  type StorageInstanceMetadata,
} from "./StorageInstanceMetadataModel";

const StorageInstanceOwnerSchema = z.object({
  ownerKind: z.nativeEnum(StorageAttachmentOwnerKinds),
  ownerId: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
}).strict();

const StorageInstanceInitializationRequestSchema = z.object({
  owner: StorageInstanceOwnerSchema,
  strategy: z.enum(["provision", "attach"]).default("provision"),
  instanceId: z.string().trim().min(1).optional(),
  attachInstanceId: z.string().trim().min(1).optional(),
  requestedBindings: z.array(z.enum(["input", "output", "intermediate"])).min(1).default(["input", "output", "intermediate"]),
  display: z.object({
    name: z.string().trim().min(1).optional(),
    summary: z.string().trim().min(1).optional(),
    tags: z.array(z.string().trim().min(1)).default([]),
  }).strict().optional(),
  shareabilityMode: z.enum(["shared", "exclusive"]).default("shared"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  contractVersion: z.string().trim().min(1).default("1.0.0"),
}).strict();

export type StorageInstanceInitializationRequest = z.infer<typeof StorageInstanceInitializationRequestSchema>;

export interface StorageInstanceInitializationResult {
  readonly metadata: StorageInstanceMetadata;
  readonly provisioningResult?: StorageInstanceProvisioningResult;
  readonly provisioned: boolean;
  readonly attached: boolean;
}

export interface StorageInstanceMetadataRepository {
  getByInstanceId(instanceId: string): Promise<StorageInstanceMetadata | undefined> | StorageInstanceMetadata | undefined;
  save(metadata: StorageInstanceMetadata): Promise<void> | void;
  list?(): Promise<ReadonlyArray<StorageInstanceMetadata>> | ReadonlyArray<StorageInstanceMetadata>;
  deleteByInstanceId?(instanceId: string): Promise<boolean> | boolean;
}

export class InMemoryStorageInstanceMetadataRepository implements StorageInstanceMetadataRepository {
  private readonly byId = new Map<string, StorageInstanceMetadata>();

  public getByInstanceId(instanceId: string): StorageInstanceMetadata | undefined {
    return this.byId.get(instanceId.trim());
  }

  public save(metadata: StorageInstanceMetadata): void {
    this.byId.set(metadata.instanceId, metadata);
  }

  public list(): ReadonlyArray<StorageInstanceMetadata> {
    return Object.freeze([...this.byId.values()]);
  }

  public deleteByInstanceId(instanceId: string): boolean {
    return this.byId.delete(instanceId.trim());
  }
}

export class StorageInstanceInitializationService {
  public constructor(
    private readonly provisioner: StorageInstanceProvisioningContract,
    private readonly metadataRepository: StorageInstanceMetadataRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async initialize(input: unknown): Promise<StorageInstanceInitializationResult> {
    const request = StorageInstanceInitializationRequestSchema.parse(input);
    this.assertNoPathConfiguration(input);

    const targetInstanceId = request.strategy === "attach"
      ? request.attachInstanceId?.trim()
      : request.instanceId?.trim();
    if (!targetInstanceId) {
      throw new Error(`Storage initialization strategy '${request.strategy}' requires a target instance id.`);
    }

    const existing = await this.metadataRepository.getByInstanceId(targetInstanceId);
    if (request.strategy === "attach" && existing) {
      const attachedMetadata = this.attachOwner(existing, request.owner.ownerKind, request.owner.ownerId, request.owner.role);
      await this.metadataRepository.save(attachedMetadata);
      return Object.freeze({
        metadata: attachedMetadata,
        provisioned: false,
        attached: true,
      });
    }

    const provisioningResult = await this.provisioner.provision(createStorageInstanceProvisioningRequest({
      instanceId: targetInstanceId,
      requestedBindings: request.requestedBindings,
      reuseExisting: request.strategy === "attach" || Boolean(existing),
      contractVersion: request.contractVersion,
      metadata: {
        ...request.metadata,
        ownerKind: request.owner.ownerKind,
        ownerId: request.owner.ownerId,
        ownerRole: request.owner.role,
        strategy: request.strategy,
      },
    }));

    const baseline = existing ?? this.createMetadataFromProvisioning({
      provisioning: provisioningResult,
      ownerKind: request.owner.ownerKind,
      ownerId: request.owner.ownerId,
      ownerRole: request.owner.role,
      display: request.display,
      shareabilityMode: request.shareabilityMode,
      metadata: request.metadata,
    });
    const attachedMetadata = this.attachOwner(baseline, request.owner.ownerKind, request.owner.ownerId, request.owner.role);
    await this.metadataRepository.save(attachedMetadata);

    return Object.freeze({
      metadata: attachedMetadata,
      provisioningResult,
      provisioned: true,
      attached: true,
    });
  }

  private createMetadataFromProvisioning(input: {
    readonly provisioning: StorageInstanceProvisioningResult;
    readonly ownerKind: StorageAttachmentOwnerKind;
    readonly ownerId: string;
    readonly ownerRole?: string;
    readonly display?: {
      readonly name?: string;
      readonly summary?: string;
      readonly tags: ReadonlyArray<string>;
    };
    readonly shareabilityMode: "shared" | "exclusive";
    readonly metadata: Readonly<Record<string, unknown>>;
  }): StorageInstanceMetadata {
    const timestamp = this.now().toISOString();
    return createStorageInstanceMetadata({
      instanceId: input.provisioning.instanceId,
      storageInstanceRef: input.provisioning.storageInstanceRef,
      provider: input.provisioning.provider,
      contractVersion: input.provisioning.contractVersion,
      display: {
        name: input.display?.name,
        summary: input.display?.summary,
        tags: input.display?.tags ?? [],
      },
      lifecycle: {
        state: StorageInstanceLifecycleStates.ready,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      bindings: input.provisioning.bindings.map((binding) => ({
        bindingId: binding.bindingId,
        area: binding.area,
        reference: binding.reference,
        provider: binding.provider,
      })),
      shareability: {
        mode: input.shareabilityMode,
        reusable: input.shareabilityMode === "shared",
      },
      attachments: [{
        attachmentId: createStorageAttachmentId({
          instanceId: input.provisioning.instanceId,
          ownerKind: input.ownerKind,
          ownerId: input.ownerId,
          role: input.ownerRole,
        }),
        ownerKind: input.ownerKind,
        ownerId: input.ownerId,
        role: input.ownerRole,
        attachedAt: timestamp,
      }],
      metadata: {
        ...input.metadata,
      },
    });
  }

  private attachOwner(
    metadata: StorageInstanceMetadata,
    ownerKind: StorageAttachmentOwnerKind,
    ownerId: string,
    role?: string,
  ): StorageInstanceMetadata {
    const attachmentId = createStorageAttachmentId({
      instanceId: metadata.instanceId,
      ownerKind,
      ownerId,
      role,
    });
    const existing = metadata.attachments.find((entry) => entry.attachmentId === attachmentId);
    if (existing) {
      return metadata;
    }
    const now = this.now().toISOString();
    return createStorageInstanceMetadata({
      ...metadata,
      lifecycle: {
        ...metadata.lifecycle,
        updatedAt: now,
      },
      attachments: [
        ...metadata.attachments,
        {
          attachmentId,
          ownerKind,
          ownerId: ownerId.trim(),
          role: role?.trim(),
          attachedAt: now,
        },
      ],
    });
  }

  private assertNoPathConfiguration(input: unknown): void {
    const root = this.toRecord(input);
    if (!root) {
      return;
    }
    if (this.hasForbiddenPathField(root)) {
      throw new Error("Storage path configuration is infrastructure-owned and cannot be provided by initialization callers.");
    }
  }

  private hasForbiddenPathField(node: Readonly<Record<string, unknown>>): boolean {
    for (const [key, value] of Object.entries(node)) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes("path")
        || normalizedKey.includes("directory")
        || normalizedKey.includes("filesystem")
        || normalizedKey.includes("storageRoot".toLowerCase())
      ) {
        return true;
      }
      const nested = this.toRecord(value);
      if (nested && this.hasForbiddenPathField(nested)) {
        return true;
      }
    }
    return false;
  }

  private toRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Readonly<Record<string, unknown>>;
  }
}

export class DeterministicStorageInstanceProvisioner implements StorageInstanceProvisioningContract {
  public async provision(input: {
    readonly instanceId: string;
    readonly requestedBindings: ReadonlyArray<StorageBindingArea>;
    readonly contractVersion: string;
    readonly reuseExisting: boolean;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): Promise<StorageInstanceProvisioningResult> {
    const normalized = createStorageInstanceProvisioningRequest(input);
    return Object.freeze({
      instanceId: normalized.instanceId,
      storageInstanceRef: `storage-instance://${encodeURIComponent(normalized.instanceId)}`,
      provider: "deterministic-storage-instance",
      contractVersion: normalized.contractVersion,
      bindings: Object.freeze(normalized.requestedBindings.map((area) => Object.freeze({
        bindingId: `storage-binding:${normalized.instanceId}:${area}`,
        area,
        reference: `storage-instance://${encodeURIComponent(normalized.instanceId)}/${area}`,
        provider: "deterministic-storage-instance",
        metadata: Object.freeze({}),
      }))),
      metadata: Object.freeze({ ...normalized.metadata }),
    });
  }
}
