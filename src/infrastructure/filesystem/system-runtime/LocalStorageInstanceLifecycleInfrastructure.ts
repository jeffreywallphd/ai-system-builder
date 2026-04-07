import fs from "node:fs";
import path from "node:path";
import type {
  StorageInstanceLifecycleInfrastructure,
} from "../../../application/system-runtime/StorageInstanceLifecycleService";
import type { StorageInstanceMetadata } from "../../../application/system-runtime/StorageInstanceMetadataModel";
import { parseStorageLogicalReference } from "../../../application/system-runtime/StorageInstanceProvisioningContract";

export class LocalStorageInstanceLifecycleInfrastructure implements StorageInstanceLifecycleInfrastructure {
  public constructor(private readonly storageRootDirectory: string) {}

  public initialize(metadata: StorageInstanceMetadata): void {
    for (const directory of this.resolveBindingDirectories(metadata)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  public reset(metadata: StorageInstanceMetadata): void {
    for (const directory of this.resolveBindingDirectories(metadata)) {
      fs.rmSync(directory, { recursive: true, force: true });
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  public archive(metadata: StorageInstanceMetadata): void {
    const instanceDirectory = this.resolveInstanceDirectory(metadata);
    if (!fs.existsSync(instanceDirectory)) {
      return;
    }
    const archiveRoot = path.join(this.storageRootDirectory, "_archive");
    fs.mkdirSync(archiveRoot, { recursive: true });
    const archiveTarget = path.join(
      archiveRoot,
      `${sanitizeSegment(metadata.instanceId)}-${Date.now()}`,
    );
    fs.renameSync(instanceDirectory, archiveTarget);
  }

  public cleanup(metadata: StorageInstanceMetadata): void {
    for (const binding of metadata.bindings) {
      if (binding.area !== "intermediate") {
        continue;
      }
      const directory = this.resolveDirectoryFromBindingReference(binding.reference);
      fs.rmSync(directory, { recursive: true, force: true });
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  public delete(metadata: StorageInstanceMetadata): void {
    fs.rmSync(this.resolveInstanceDirectory(metadata), { recursive: true, force: true });
  }

  private resolveBindingDirectories(metadata: StorageInstanceMetadata): ReadonlyArray<string> {
    return Object.freeze(metadata.bindings.map((binding) => this.resolveDirectoryFromBindingReference(binding.reference)));
  }

  private resolveDirectoryFromBindingReference(reference: string): string {
    const parsed = parseStorageLogicalReference(reference);
    if (!parsed.area) {
      throw new Error(`Storage binding reference '${reference}' is missing an area.`);
    }
    return path.join(this.storageRootDirectory, sanitizeSegment(parsed.instanceId), sanitizeSegment(parsed.area));
  }

  private resolveInstanceDirectory(metadata: StorageInstanceMetadata): string {
    return path.join(this.storageRootDirectory, sanitizeSegment(metadata.instanceId));
  }
}

function sanitizeSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9-_:]+/g, "-").replace(/-+/g, "-");
  if (!normalized) {
    throw new Error("Path segment cannot be empty.");
  }
  return normalized;
}
