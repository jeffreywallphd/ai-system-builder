import fs from "node:fs";
import path from "node:path";
import {
  createStorageInstanceProvisioningRequest,
  createStorageInstanceProvisioningResult,
  createStorageLogicalReference,
  type StorageBindingArea,
  type StorageInstanceProvisioningContract,
  type StorageInstanceProvisioningRequest,
  type StorageInstanceProvisioningResult,
} from "@application/system-runtime/StorageInstanceProvisioningContract";

export interface LocalStorageInstanceProvisionerOptions {
  readonly storageRootDirectory: string;
}

export interface LocalStorageFilesystemBinding {
  readonly area: StorageBindingArea;
  readonly absolutePath: string;
  readonly relativePath: string;
}

export interface LocalStorageInstanceProvisioningResult extends StorageInstanceProvisioningResult {
  readonly filesystem: Readonly<{
    readonly rootDirectory: string;
    readonly instanceDirectory: string;
    readonly bindings: ReadonlyArray<LocalStorageFilesystemBinding>;
  }>;
}

export class LocalStorageInstanceProvisioner implements StorageInstanceProvisioningContract {
  private readonly storageRootDirectory: string;

  public constructor(options: LocalStorageInstanceProvisionerOptions) {
    const normalizedRoot = options.storageRootDirectory.trim();
    if (!normalizedRoot) {
      throw new Error("storageRootDirectory is required.");
    }
    this.storageRootDirectory = normalizedRoot;
  }

  public async provision(request: StorageInstanceProvisioningRequest): Promise<LocalStorageInstanceProvisioningResult> {
    const normalized = createStorageInstanceProvisioningRequest(request);
    const instanceDirectory = path.join(this.storageRootDirectory, sanitizeSegment(normalized.instanceId));
    fs.mkdirSync(instanceDirectory, { recursive: true });

    const filesystemBindings: LocalStorageFilesystemBinding[] = [];
    const logicalBindings = normalized.requestedBindings.map((area) => {
      const absolutePath = path.join(instanceDirectory, area);
      fs.mkdirSync(absolutePath, { recursive: true });
      const relativePath = path.relative(this.storageRootDirectory, absolutePath).split(path.sep).join("/");
      filesystemBindings.push(Object.freeze({ area, absolutePath, relativePath }));

      return Object.freeze({
        bindingId: `storage-binding:${normalized.instanceId}:${area}`,
        area,
        reference: createStorageLogicalReference(normalized.instanceId, area),
        provider: "local-filesystem-storage-instance",
        metadata: Object.freeze({
          role: area,
        }),
      });
    });

    return Object.freeze({
      ...createStorageInstanceProvisioningResult({
        instanceId: normalized.instanceId,
        storageInstanceRef: `storage-instance://${encodeURIComponent(normalized.instanceId)}`,
        provider: "local-filesystem-storage-instance",
        contractVersion: normalized.contractVersion,
        bindings: logicalBindings,
        metadata: Object.freeze({
          reused: normalized.reuseExisting,
        }),
      }),
      filesystem: Object.freeze({
        rootDirectory: this.storageRootDirectory,
        instanceDirectory,
        bindings: Object.freeze(filesystemBindings),
      }),
    });
  }
}

function sanitizeSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9-_:]+/g, "-").replace(/-+/g, "-");
  if (!normalized) {
    throw new Error("Storage instance id cannot be empty.");
  }
  return normalized;
}

