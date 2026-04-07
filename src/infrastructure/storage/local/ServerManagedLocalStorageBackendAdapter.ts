import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  IStorageCapabilityInspectionPort,
  StorageBackendCapabilitySnapshot,
  StorageCapabilityInspectionRequest,
  StorageInstanceCapabilityInspectionRequest,
} from "@application/storage/ports/StorageCapabilityInspectionPort";
import { StorageBackendHealthStatuses } from "@application/storage/ports/StorageCapabilityInspectionPort";
import type {
  IStorageProvisioningPort,
  StorageProvisioningReceipt,
  StorageProvisioningRequest,
} from "@application/storage/ports/StorageProvisioningPort";
import { StorageProvisioningOperationStatuses } from "@application/storage/ports/StorageProvisioningPort";
import { StorageBackendTypes, type StorageInstance } from "@domain/storage/StorageDomain";

export const LocalStorageProvisioningReasonCodes = Object.freeze({
  backendUnsupported: "local-backend-unsupported",
  bindingProvisioned: "local-binding-provisioned",
  bindingAlreadyProvisioned: "local-binding-already-provisioned",
  bindingMissing: "local-binding-missing",
  bindingPathConflict: "local-binding-path-conflict",
  replicationUnsupported: "local-replication-unsupported",
  filesystemFailure: "local-filesystem-failure",
});

export type LocalStorageProvisioningReasonCode =
  typeof LocalStorageProvisioningReasonCodes[keyof typeof LocalStorageProvisioningReasonCodes];

export interface LocalStorageBackendInitializationPolicy {
  readonly managedSubdirectories?: ReadonlyArray<string>;
}

export interface LocalStorageBackendConfiguration {
  readonly managedStorageRootPath: string;
  readonly backendBindingReferencePrefix?: string;
  readonly maxObjectBytesLimit?: number;
  readonly supportsReadOnlyActive?: boolean;
  readonly supportsCrossWorkspaceReads?: boolean;
  readonly initialization?: LocalStorageBackendInitializationPolicy;
}

export interface LocalStorageFilesystem {
  isDirectory(absolutePath: string): boolean;
  exists(absolutePath: string): boolean;
  ensureDirectory(absolutePath: string): void;
}

const DefaultManagedSubdirectories = Object.freeze(["input", "output", "intermediate"]);

const HealthNotes = Object.freeze({
  rootHealthy: "root-health:healthy",
  rootMissing: "root-health:missing",
  bindingHealthy: "binding-health:healthy",
  bindingMissing: "binding-health:missing",
  bindingPathConflict: "binding-health:path-conflict",
});

const DefaultLocalStorageFilesystem: LocalStorageFilesystem = Object.freeze({
  isDirectory(absolutePath: string): boolean {
    try {
      return fs.statSync(absolutePath).isDirectory();
    } catch {
      return false;
    }
  },
  exists(absolutePath: string): boolean {
    return fs.existsSync(absolutePath);
  },
  ensureDirectory(absolutePath: string): void {
    fs.mkdirSync(absolutePath, { recursive: true });
  },
});

export class ServerManagedLocalStorageBackendAdapter implements IStorageProvisioningPort, IStorageCapabilityInspectionPort {
  private readonly managedStorageRootPath: string;
  private readonly backendBindingReferencePrefix: string;
  private readonly managedSubdirectories: ReadonlyArray<string>;
  private readonly maxObjectBytesLimit?: number;
  private readonly supportsReadOnlyActive: boolean;
  private readonly supportsCrossWorkspaceReads: boolean;
  private readonly filesystem: LocalStorageFilesystem;

  public constructor(
    configuration: LocalStorageBackendConfiguration,
    filesystem: LocalStorageFilesystem = DefaultLocalStorageFilesystem,
  ) {
    const normalizedRoot = configuration.managedStorageRootPath.trim();
    if (!normalizedRoot) {
      throw new Error("Local storage backend configuration requires managedStorageRootPath.");
    }

    this.managedStorageRootPath = path.resolve(normalizedRoot);
    const normalizedBindingPrefix = (configuration.backendBindingReferencePrefix ?? "local-managed-storage").trim();
    if (!normalizedBindingPrefix) {
      throw new Error("Local storage backend configuration requires a non-empty backendBindingReferencePrefix.");
    }
    this.backendBindingReferencePrefix = normalizedBindingPrefix;
    if (configuration.maxObjectBytesLimit !== undefined && configuration.maxObjectBytesLimit < 1) {
      throw new Error("Local storage backend configuration maxObjectBytesLimit must be >= 1 when provided.");
    }
    this.managedSubdirectories = this.normalizeManagedSubdirectories(configuration.initialization?.managedSubdirectories);
    this.maxObjectBytesLimit = configuration.maxObjectBytesLimit;
    this.supportsReadOnlyActive = configuration.supportsReadOnlyActive ?? true;
    this.supportsCrossWorkspaceReads = configuration.supportsCrossWorkspaceReads ?? false;
    this.filesystem = filesystem;
  }

  public async requestStorageProvisioning(input: StorageProvisioningRequest): Promise<StorageProvisioningReceipt> {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    if (!this.supportsBackend(input.storageInstance)) {
      return this.rejectedReceipt(
        occurredAt,
        LocalStorageProvisioningReasonCodes.backendUnsupported,
        `Storage backend '${input.storageInstance.backendType}' is not supported by the local managed adapter.`,
      );
    }

    const binding = this.resolveBinding(input.storageInstance);
    try {
      this.filesystem.ensureDirectory(this.managedStorageRootPath);
      switch (input.operationKind) {
        case "create": {
          if (this.filesystem.isDirectory(binding.absolutePath)) {
            return this.successReceipt(
              "already-applied",
              occurredAt,
              binding.backendBindingReferenceId,
              LocalStorageProvisioningReasonCodes.bindingAlreadyProvisioned,
              "Storage binding already exists.",
            );
          }
          if (this.filesystem.exists(binding.absolutePath) && !this.filesystem.isDirectory(binding.absolutePath)) {
            return this.rejectedReceipt(
              occurredAt,
              LocalStorageProvisioningReasonCodes.bindingPathConflict,
              "Storage binding path exists but is not a directory.",
            );
          }

          this.filesystem.ensureDirectory(binding.absolutePath);
          for (const childDirectory of this.managedSubdirectories) {
            this.filesystem.ensureDirectory(path.join(binding.absolutePath, childDirectory));
          }

          return this.successReceipt(
            StorageProvisioningOperationStatuses.accepted,
            occurredAt,
            binding.backendBindingReferenceId,
            LocalStorageProvisioningReasonCodes.bindingProvisioned,
            "Storage binding provisioned.",
          );
        }
        case "activate": {
          if (this.filesystem.isDirectory(binding.absolutePath)) {
            return this.successReceipt(
              StorageProvisioningOperationStatuses.accepted,
              occurredAt,
              binding.backendBindingReferenceId,
              LocalStorageProvisioningReasonCodes.bindingAlreadyProvisioned,
              "Storage binding is available for activation.",
            );
          }
          if (this.filesystem.exists(binding.absolutePath)) {
            return this.rejectedReceipt(
              occurredAt,
              LocalStorageProvisioningReasonCodes.bindingPathConflict,
              "Storage binding path exists but is not a directory.",
            );
          }
          return this.rejectedReceipt(
            occurredAt,
            LocalStorageProvisioningReasonCodes.bindingMissing,
            "Storage binding must be provisioned before activation.",
          );
        }
        case "deactivate": {
          if (this.filesystem.isDirectory(binding.absolutePath)) {
            return this.successReceipt(
              StorageProvisioningOperationStatuses.alreadyApplied,
              occurredAt,
              binding.backendBindingReferenceId,
              LocalStorageProvisioningReasonCodes.bindingAlreadyProvisioned,
              "Deactivation does not remove local storage bindings.",
            );
          }
          return this.successReceipt(
            StorageProvisioningOperationStatuses.alreadyApplied,
            occurredAt,
            binding.backendBindingReferenceId,
            LocalStorageProvisioningReasonCodes.bindingMissing,
            "Storage binding not present; deactivation already satisfied.",
          );
        }
        case "replication-sync":
          return this.rejectedReceipt(
            occurredAt,
            LocalStorageProvisioningReasonCodes.replicationUnsupported,
            "Local managed storage backend does not support replication sync operations.",
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown filesystem failure.";
      return this.rejectedReceipt(
        occurredAt,
        LocalStorageProvisioningReasonCodes.filesystemFailure,
        `Local storage provisioning failed: ${message}`,
      );
    }
  }

  public async inspectStorageBackendCapabilities(
    input: StorageCapabilityInspectionRequest,
  ): Promise<StorageBackendCapabilitySnapshot> {
    const checkedAt = input.occurredAt ?? new Date().toISOString();
    if (input.backendType !== StorageBackendTypes.managedFilesystem) {
      return Object.freeze({
        backendType: input.backendType,
        supportsManagedLifecycle: false,
        supportsAsyncReplication: false,
        supportsSyncReplication: false,
        supportsReadOnlyActive: false,
        supportsCrossWorkspaceReads: false,
        notes: Object.freeze([`backend-support:unsupported:${input.backendType}`]),
        health: Object.freeze({
          status: StorageBackendHealthStatuses.unsupported,
          reasonCode: "backend-support-unsupported",
          checkedAt,
        }),
      });
    }

    const notes = this.buildHealthNotes();
    notes.push(`managed-subdirectories:${this.managedSubdirectories.join(",")}`);
    notes.push(`binding-reference-prefix:${this.backendBindingReferencePrefix}`);

    return Object.freeze({
      backendType: input.backendType,
      supportsManagedLifecycle: true,
      supportsAsyncReplication: false,
      supportsSyncReplication: false,
      supportsReadOnlyActive: this.supportsReadOnlyActive,
      supportsCrossWorkspaceReads: this.supportsCrossWorkspaceReads,
      maxObjectBytesLimit: this.maxObjectBytesLimit,
      notes: Object.freeze(notes),
      health: Object.freeze({
        status: notes.includes(HealthNotes.rootHealthy)
          ? StorageBackendHealthStatuses.healthy
          : StorageBackendHealthStatuses.unhealthy,
        reasonCode: notes.includes(HealthNotes.rootHealthy)
          ? "storage-root-healthy"
          : "storage-root-missing",
        checkedAt,
        notes: Object.freeze([...notes]),
      }),
    });
  }

  public async inspectStorageInstanceCapabilities(
    input: StorageInstanceCapabilityInspectionRequest,
  ): Promise<StorageBackendCapabilitySnapshot> {
    const checkedAt = input.occurredAt ?? new Date().toISOString();
    const backendCapabilities = await this.inspectStorageBackendCapabilities({
      backendType: input.storageInstance.backendType,
      workspaceId: input.storageInstance.ownership.workspaceId,
      requestedReplicationMode: input.storageInstance.replication.mode,
      occurredAt: input.occurredAt,
    });
    if (!backendCapabilities.supportsManagedLifecycle) {
      return backendCapabilities;
    }

    const notes = [...(backendCapabilities.notes ?? [])];
    const binding = this.resolveBinding(input.storageInstance);
    let healthStatus = StorageBackendHealthStatuses.healthy;
    let reasonCode = "binding-health-healthy";
    if (this.filesystem.isDirectory(binding.absolutePath)) {
      notes.push(HealthNotes.bindingHealthy);
    } else if (this.filesystem.exists(binding.absolutePath)) {
      notes.push(HealthNotes.bindingPathConflict);
      healthStatus = StorageBackendHealthStatuses.unhealthy;
      reasonCode = "binding-path-conflict";
    } else {
      notes.push(HealthNotes.bindingMissing);
      healthStatus = StorageBackendHealthStatuses.unhealthy;
      reasonCode = "binding-missing";
    }
    notes.push(`binding-reference:${binding.backendBindingReferenceId}`);

    return Object.freeze({
      ...backendCapabilities,
      notes: Object.freeze(notes),
      health: Object.freeze({
        status: healthStatus,
        reasonCode,
        checkedAt,
        notes: Object.freeze([...notes]),
      }),
    });
  }

  private supportsBackend(storageInstance: StorageInstance): boolean {
    return storageInstance.backendType === StorageBackendTypes.managedFilesystem;
  }

  private resolveBinding(storageInstance: StorageInstance): {
    readonly absolutePath: string;
    readonly backendBindingReferenceId: string;
  } {
    const workspaceSegment = this.toSafePathSegment(storageInstance.ownership.workspaceId);
    const storageSegment = this.toSafePathSegment(storageInstance.id);
    const absolutePath = path.join(this.managedStorageRootPath, "workspaces", workspaceSegment, "storage", storageSegment);
    return Object.freeze({
      absolutePath,
      backendBindingReferenceId: `${this.backendBindingReferencePrefix}:${storageInstance.ownership.workspaceId}:${storageInstance.id}`,
    });
  }

  private toSafePathSegment(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const hash = createHash("sha256").update(value).digest("hex").slice(0, 12);
    return `${normalized || "id"}-${hash}`;
  }

  private normalizeManagedSubdirectories(input?: ReadonlyArray<string>): ReadonlyArray<string> {
    const normalized = (input ?? DefaultManagedSubdirectories)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(entry));
    if (normalized.length < 1) {
      return DefaultManagedSubdirectories;
    }
    return Object.freeze([...new Set(normalized)]);
  }

  private buildHealthNotes(): string[] {
    return this.filesystem.isDirectory(this.managedStorageRootPath)
      ? [HealthNotes.rootHealthy]
      : [HealthNotes.rootMissing];
  }

  private successReceipt(
    status: StorageProvisioningReceipt["status"],
    occurredAt: string,
    backendRequestId: string,
    reasonCode: LocalStorageProvisioningReasonCode,
    message: string,
  ): StorageProvisioningReceipt {
    return Object.freeze({
      status,
      accepted: true,
      backendRequestId,
      occurredAt,
      reasonCode,
      message,
    });
  }

  private rejectedReceipt(
    occurredAt: string,
    reasonCode: LocalStorageProvisioningReasonCode,
    message: string,
  ): StorageProvisioningReceipt {
    return Object.freeze({
      status: StorageProvisioningOperationStatuses.rejected,
      accepted: false,
      occurredAt,
      reasonCode,
      message,
    });
  }
}

