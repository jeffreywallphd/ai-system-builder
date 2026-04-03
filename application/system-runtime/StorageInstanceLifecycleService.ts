import {
  StorageInstanceLifecycleStates,
  createStorageAttachmentId,
  createStorageInstanceMetadata,
  type StorageAttachmentOwnerKind,
  type StorageInstanceMetadata,
} from "./StorageInstanceMetadataModel";
import type { StorageInstanceMetadataRepository } from "./StorageInstanceInitializationService";

export interface StorageInstanceLifecycleInfrastructure {
  initialize(metadata: StorageInstanceMetadata): Promise<void> | void;
  reset(metadata: StorageInstanceMetadata): Promise<void> | void;
  archive(metadata: StorageInstanceMetadata): Promise<void> | void;
  cleanup(metadata: StorageInstanceMetadata): Promise<void> | void;
  delete(metadata: StorageInstanceMetadata): Promise<void> | void;
}

export interface StorageInstanceLifecycleDeleteResult {
  readonly instanceId: string;
  readonly deleted: boolean;
}

export class NoopStorageInstanceLifecycleInfrastructure implements StorageInstanceLifecycleInfrastructure {
  public initialize(): void {}
  public reset(): void {}
  public archive(): void {}
  public cleanup(): void {}
  public delete(): void {}
}

export class StorageInstanceLifecycleService {
  public constructor(
    private readonly metadataRepository: StorageInstanceMetadataRepository,
    private readonly infrastructure: StorageInstanceLifecycleInfrastructure = new NoopStorageInstanceLifecycleInfrastructure(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async initialize(instanceId: string): Promise<StorageInstanceMetadata> {
    const metadata = await this.requireInstance(instanceId);
    await this.infrastructure.initialize(metadata);
    return this.saveWithLifecycle(metadata, { state: StorageInstanceLifecycleStates.ready });
  }

  public async reset(instanceId: string): Promise<StorageInstanceMetadata> {
    const metadata = await this.requireInstance(instanceId);
    await this.infrastructure.reset(metadata);
    return this.saveWithLifecycle(metadata, { state: StorageInstanceLifecycleStates.ready });
  }

  public async archive(instanceId: string): Promise<StorageInstanceMetadata> {
    const metadata = await this.requireInstance(instanceId);
    await this.infrastructure.archive(metadata);
    return this.saveWithLifecycle(metadata, { state: StorageInstanceLifecycleStates.archived, archive: true });
  }

  public async cleanup(instanceId: string): Promise<StorageInstanceMetadata> {
    const metadata = await this.requireInstance(instanceId);
    await this.infrastructure.cleanup(metadata);
    return this.saveWithLifecycle(metadata, { state: metadata.lifecycle.state });
  }

  public async detach(input: {
    readonly instanceId: string;
    readonly ownerKind: StorageAttachmentOwnerKind;
    readonly ownerId: string;
    readonly role?: string;
  }): Promise<StorageInstanceMetadata> {
    const metadata = await this.requireInstance(input.instanceId);
    const attachmentId = createStorageAttachmentId(input);
    const nextAttachments = metadata.attachments.filter((entry) => entry.attachmentId !== attachmentId);
    if (nextAttachments.length === metadata.attachments.length) {
      return metadata;
    }
    const nowIso = this.now().toISOString();
    const next = createStorageInstanceMetadata({
      ...metadata,
      lifecycle: {
        ...metadata.lifecycle,
        updatedAt: nowIso,
      },
      attachments: nextAttachments,
    });
    await this.metadataRepository.save(next);
    return next;
  }

  public async safeDelete(instanceId: string): Promise<StorageInstanceLifecycleDeleteResult> {
    const metadata = await this.requireInstance(instanceId);
    if (metadata.attachments.length > 0) {
      throw new Error(
        `invalid-request:Storage instance '${metadata.instanceId}' cannot be deleted while attachments are present.`,
      );
    }
    if (metadata.lifecycle.state !== StorageInstanceLifecycleStates.archived) {
      throw new Error(
        `invalid-request:Storage instance '${metadata.instanceId}' must be archived before deletion.`,
      );
    }
    await this.infrastructure.delete(metadata);
    const removed = this.metadataRepository.deleteByInstanceId?.(metadata.instanceId) ?? false;
    return Object.freeze({
      instanceId: metadata.instanceId,
      deleted: Boolean(removed),
    });
  }

  private async requireInstance(instanceId: string): Promise<StorageInstanceMetadata> {
    const normalized = instanceId.trim();
    if (!normalized) {
      throw new Error("instanceId is required.");
    }
    const metadata = await this.metadataRepository.getByInstanceId(normalized);
    if (!metadata) {
      throw new Error(`not-found:Storage instance '${normalized}' was not found.`);
    }
    return metadata;
  }

  private async saveWithLifecycle(
    metadata: StorageInstanceMetadata,
    next: {
      readonly state: StorageInstanceMetadata["lifecycle"]["state"];
      readonly archive?: boolean;
    },
  ): Promise<StorageInstanceMetadata> {
    const nowIso = this.now().toISOString();
    const updated = createStorageInstanceMetadata({
      ...metadata,
      lifecycle: {
        ...metadata.lifecycle,
        state: next.state,
        updatedAt: nowIso,
        archivedAt: next.archive ? nowIso : undefined,
      },
    });
    await this.metadataRepository.save(updated);
    return updated;
  }
}
