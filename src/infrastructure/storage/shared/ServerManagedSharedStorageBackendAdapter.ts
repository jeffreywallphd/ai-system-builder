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
import {
  StorageAccessModes,
  StorageBackendTypes,
  StorageReplicationModes,
  type StorageInstance,
  type StorageReplicationMode,
} from "@domain/storage/StorageDomain";

export const SharedStorageProvisioningReasonCodes = Object.freeze({
  backendUnsupported: "shared-backend-unsupported",
  targetUnspecified: "shared-target-unspecified",
  targetUnknown: "shared-target-unknown",
  targetWorkspaceNotAllowed: "shared-target-workspace-not-allowed",
  bindingMissing: "shared-binding-missing",
  bindingPathConflict: "shared-binding-path-conflict",
  bindingPermissionDenied: "shared-binding-permission-denied",
  compatibilityMismatch: "shared-compatibility-mismatch",
  bindingValidated: "shared-binding-validated",
  bindingCreated: "shared-binding-created",
  replicationUnsupported: "shared-replication-unsupported",
  filesystemFailure: "shared-filesystem-failure",
});

export type SharedStorageProvisioningReasonCode =
  typeof SharedStorageProvisioningReasonCodes[keyof typeof SharedStorageProvisioningReasonCodes];

export interface SharedStorageTargetCompatibility {
  readonly supportsReadOnlyActive?: boolean;
  readonly supportsCrossWorkspaceReads?: boolean;
  readonly supportsAsyncReplication?: boolean;
  readonly supportsSyncReplication?: boolean;
  readonly maxObjectBytesLimit?: number;
  readonly minReplicationSyncIntervalSeconds?: number;
  readonly capabilityTags?: ReadonlyArray<string>;
}

export interface SharedStorageTargetDefinition {
  readonly targetId: string;
  readonly absolutePath: string;
  readonly readOnly?: boolean;
  readonly allowedWorkspaceIds?: ReadonlyArray<string>;
  readonly requiresExistingBindingPath?: boolean;
  readonly createBindingPathIfMissing?: boolean;
  readonly sharedPathStrategy?: "workspace-storage" | "workspace-only" | "none";
  readonly compatibility?: SharedStorageTargetCompatibility;
}

export interface SharedStorageBackendConfiguration {
  readonly targets: ReadonlyArray<SharedStorageTargetDefinition>;
  readonly backendBindingReferencePrefix?: string;
  readonly targetLabelKey?: string;
  readonly defaultTargetIdByWorkspace?: Readonly<Record<string, string>>;
}

export interface SharedStorageFilesystem {
  exists(absolutePath: string): boolean;
  isDirectory(absolutePath: string): boolean;
  ensureDirectory(absolutePath: string): void;
  canRead(absolutePath: string): boolean;
  canWrite(absolutePath: string): boolean;
}

interface NormalizedSharedStorageTarget {
  readonly targetId: string;
  readonly absolutePath: string;
  readonly readOnly: boolean;
  readonly allowedWorkspaceIds?: ReadonlySet<string>;
  readonly requiresExistingBindingPath: boolean;
  readonly createBindingPathIfMissing: boolean;
  readonly sharedPathStrategy: "workspace-storage" | "workspace-only" | "none";
  readonly compatibility: {
    readonly supportsReadOnlyActive: boolean;
    readonly supportsCrossWorkspaceReads: boolean;
    readonly supportsAsyncReplication: boolean;
    readonly supportsSyncReplication: boolean;
    readonly maxObjectBytesLimit?: number;
    readonly minReplicationSyncIntervalSeconds?: number;
    readonly capabilityTags: ReadonlyArray<string>;
  };
}

const HealthNotes = Object.freeze({
  bindingHealthy: "binding-health:healthy",
  bindingMissing: "binding-health:missing",
  bindingPathConflict: "binding-health:path-conflict",
  bindingPermissionDenied: "binding-health:permission-denied",
  bindingTargetUnresolved: "binding-target:unresolved",
  targetWorkspaceRejected: "binding-target:workspace-rejected",
});

const DefaultSharedStorageFilesystem: SharedStorageFilesystem = Object.freeze({
  exists(absolutePath: string): boolean {
    return fs.existsSync(absolutePath);
  },
  isDirectory(absolutePath: string): boolean {
    try {
      return fs.statSync(absolutePath).isDirectory();
    } catch {
      return false;
    }
  },
  ensureDirectory(absolutePath: string): void {
    fs.mkdirSync(absolutePath, { recursive: true });
  },
  canRead(absolutePath: string): boolean {
    try {
      fs.accessSync(absolutePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  },
  canWrite(absolutePath: string): boolean {
    try {
      fs.accessSync(absolutePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  },
});

export class ServerManagedSharedStorageBackendAdapter implements IStorageProvisioningPort, IStorageCapabilityInspectionPort {
  private readonly backendBindingReferencePrefix: string;
  private readonly targetLabelKey: string;
  private readonly targetsById: ReadonlyMap<string, NormalizedSharedStorageTarget>;
  private readonly defaultTargetIdByWorkspace: Readonly<Record<string, string>>;
  private readonly filesystem: SharedStorageFilesystem;

  public constructor(
    configuration: SharedStorageBackendConfiguration,
    filesystem: SharedStorageFilesystem = DefaultSharedStorageFilesystem,
  ) {
    const normalizedBindingPrefix = (configuration.backendBindingReferencePrefix ?? "shared-managed-storage").trim();
    if (!normalizedBindingPrefix) {
      throw new Error("Shared storage backend configuration requires a non-empty backendBindingReferencePrefix.");
    }
    const targetLabelKey = (configuration.targetLabelKey ?? "sharedTargetId").trim();
    if (!targetLabelKey) {
      throw new Error("Shared storage backend configuration requires a non-empty targetLabelKey.");
    }

    if (!Array.isArray(configuration.targets) || configuration.targets.length < 1) {
      throw new Error("Shared storage backend configuration requires at least one target.");
    }

    const normalizedTargets = new Map<string, NormalizedSharedStorageTarget>();
    for (const target of configuration.targets) {
      const normalizedTarget = this.normalizeTarget(target);
      if (normalizedTargets.has(normalizedTarget.targetId)) {
        throw new Error(`Shared storage backend target '${normalizedTarget.targetId}' is defined more than once.`);
      }
      normalizedTargets.set(normalizedTarget.targetId, normalizedTarget);
    }

    const defaultTargetIdByWorkspace = Object.freeze(
      Object.fromEntries(
        Object.entries(configuration.defaultTargetIdByWorkspace ?? {}).map(([workspaceId, targetId]) => {
          const normalizedWorkspaceId = workspaceId.trim();
          const normalizedTargetId = targetId.trim();
          if (!normalizedWorkspaceId || !normalizedTargetId) {
            throw new Error("Shared storage backend defaultTargetIdByWorkspace requires non-empty workspace and target ids.");
          }
          if (!normalizedTargets.has(normalizedTargetId)) {
            throw new Error(
              `Shared storage backend default target '${normalizedTargetId}' is not present in targets configuration.`,
            );
          }
          return [normalizedWorkspaceId, normalizedTargetId];
        }),
      ),
    );

    this.backendBindingReferencePrefix = normalizedBindingPrefix;
    this.targetLabelKey = targetLabelKey;
    this.targetsById = normalizedTargets;
    this.defaultTargetIdByWorkspace = defaultTargetIdByWorkspace;
    this.filesystem = filesystem;
  }

  public async requestStorageProvisioning(input: StorageProvisioningRequest): Promise<StorageProvisioningReceipt> {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    if (input.storageInstance.backendType !== StorageBackendTypes.networkShare) {
      return this.rejectedReceipt(
        occurredAt,
        SharedStorageProvisioningReasonCodes.backendUnsupported,
        `Storage backend '${input.storageInstance.backendType}' is not supported by the shared managed adapter.`,
      );
    }

    const targetResolution = this.resolveTarget(input.storageInstance);
    if (!targetResolution.ok) {
      return this.rejectedReceipt(occurredAt, targetResolution.reasonCode, targetResolution.message);
    }

    const binding = this.resolveBinding(input.storageInstance, targetResolution.target);
    const compatibilityError = this.validateStorageCompatibility(input.storageInstance, targetResolution.target);
    if (compatibilityError) {
      return this.rejectedReceipt(
        occurredAt,
        SharedStorageProvisioningReasonCodes.compatibilityMismatch,
        compatibilityError,
      );
    }

    try {
      switch (input.operationKind) {
        case "create":
          return this.validateOrCreateBinding(occurredAt, input.storageInstance, targetResolution.target, binding, true);
        case "activate":
          return this.validateOrCreateBinding(occurredAt, input.storageInstance, targetResolution.target, binding, false);
        case "deactivate":
          return this.successReceipt(
            StorageProvisioningOperationStatuses.alreadyApplied,
            occurredAt,
            binding.backendBindingReferenceId,
            SharedStorageProvisioningReasonCodes.bindingValidated,
            "Shared storage binding deactivation is lifecycle-only.",
          );
        case "replication-sync":
          if (!this.replicationModeSupported(input.storageInstance.replication.mode, targetResolution.target)) {
            return this.rejectedReceipt(
              occurredAt,
              SharedStorageProvisioningReasonCodes.replicationUnsupported,
              "Shared storage target does not support the requested replication mode.",
            );
          }
          return this.validateOrCreateBinding(occurredAt, input.storageInstance, targetResolution.target, binding, false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown filesystem failure.";
      return this.rejectedReceipt(
        occurredAt,
        SharedStorageProvisioningReasonCodes.filesystemFailure,
        `Shared storage provisioning failed: ${message}`,
      );
    }
  }

  public async inspectStorageBackendCapabilities(
    input: StorageCapabilityInspectionRequest,
  ): Promise<StorageBackendCapabilitySnapshot> {
    const checkedAt = input.occurredAt ?? new Date().toISOString();
    if (input.backendType !== StorageBackendTypes.networkShare) {
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

    const targets = [...this.targetsById.values()];
    const maxObjectLimits = targets
      .map((target) => target.compatibility.maxObjectBytesLimit)
      .filter((limit): limit is number => typeof limit === "number");
    const minReplicationIntervals = targets
      .map((target) => target.compatibility.minReplicationSyncIntervalSeconds)
      .filter((value): value is number => typeof value === "number");
    const notes: string[] = [
      `target-label-key:${this.targetLabelKey}`,
      `target-count:${targets.length}`,
    ];
    for (const target of targets) {
      notes.push(`target:${target.targetId}:path-strategy:${target.sharedPathStrategy}`);
      notes.push(`target:${target.targetId}:read-only:${target.readOnly}`);
      notes.push(`target:${target.targetId}:requires-existing-binding:${target.requiresExistingBindingPath}`);
      if (target.allowedWorkspaceIds) {
        notes.push(`target:${target.targetId}:workspace-scope:restricted`);
      } else {
        notes.push(`target:${target.targetId}:workspace-scope:any`);
      }
      for (const tag of target.compatibility.capabilityTags) {
        notes.push(`target:${target.targetId}:tag:${tag}`);
      }
    }

    return Object.freeze({
      backendType: input.backendType,
      supportsManagedLifecycle: true,
      supportsAsyncReplication: targets.some((target) => target.compatibility.supportsAsyncReplication),
      supportsSyncReplication: targets.some((target) => target.compatibility.supportsSyncReplication),
      supportsReadOnlyActive: targets.some((target) => target.compatibility.supportsReadOnlyActive),
      supportsCrossWorkspaceReads: targets.some((target) => target.compatibility.supportsCrossWorkspaceReads),
      maxObjectBytesLimit: maxObjectLimits.length > 0 ? Math.min(...maxObjectLimits) : undefined,
      minReplicationSyncIntervalSeconds: minReplicationIntervals.length > 0 ? Math.max(...minReplicationIntervals) : undefined,
      notes: Object.freeze(notes),
      health: Object.freeze({
        status: StorageBackendHealthStatuses.healthy,
        reasonCode: "shared-targets-configured",
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

    const targetResolution = this.resolveTarget(input.storageInstance);
    const notes = [...(backendCapabilities.notes ?? [])];
    if (!targetResolution.ok) {
      notes.push(HealthNotes.bindingTargetUnresolved);
      notes.push(`binding-target-error:${targetResolution.reasonCode}`);
      return Object.freeze({
        ...backendCapabilities,
        notes: Object.freeze(notes),
        health: Object.freeze({
          status: StorageBackendHealthStatuses.unsupported,
          reasonCode: targetResolution.reasonCode,
          checkedAt,
          notes: Object.freeze([...notes]),
        }),
      });
    }

    const target = targetResolution.target;
    const binding = this.resolveBinding(input.storageInstance, target);
    notes.push(`binding-target:${target.targetId}`);
    notes.push(`binding-reference:${binding.backendBindingReferenceId}`);

    if (target.allowedWorkspaceIds && !target.allowedWorkspaceIds.has(input.storageInstance.ownership.workspaceId)) {
      notes.push(HealthNotes.targetWorkspaceRejected);
    }

    let healthStatus = StorageBackendHealthStatuses.healthy;
    let reasonCode = "binding-health-healthy";
    if (!this.filesystem.exists(binding.absolutePath)) {
      notes.push(HealthNotes.bindingMissing);
      healthStatus = StorageBackendHealthStatuses.unhealthy;
      reasonCode = "binding-missing";
    } else if (!this.filesystem.isDirectory(binding.absolutePath)) {
      notes.push(HealthNotes.bindingPathConflict);
      healthStatus = StorageBackendHealthStatuses.unhealthy;
      reasonCode = "binding-path-conflict";
    } else {
      if (!this.filesystem.canRead(binding.absolutePath)) {
        notes.push(HealthNotes.bindingPermissionDenied);
        healthStatus = StorageBackendHealthStatuses.unhealthy;
        reasonCode = "binding-permission-denied";
      } else if (this.requiresWriteAccess(input.storageInstance, target) && !this.filesystem.canWrite(binding.absolutePath)) {
        notes.push(HealthNotes.bindingPermissionDenied);
        healthStatus = StorageBackendHealthStatuses.unhealthy;
        reasonCode = "binding-permission-denied";
      } else {
        notes.push(HealthNotes.bindingHealthy);
      }
    }

    return Object.freeze({
      backendType: input.storageInstance.backendType,
      supportsManagedLifecycle: true,
      supportsAsyncReplication: target.compatibility.supportsAsyncReplication,
      supportsSyncReplication: target.compatibility.supportsSyncReplication,
      supportsReadOnlyActive: target.compatibility.supportsReadOnlyActive,
      supportsCrossWorkspaceReads: target.compatibility.supportsCrossWorkspaceReads,
      maxObjectBytesLimit: target.compatibility.maxObjectBytesLimit,
      minReplicationSyncIntervalSeconds: target.compatibility.minReplicationSyncIntervalSeconds,
      notes: Object.freeze(notes),
      health: Object.freeze({
        status: healthStatus,
        reasonCode,
        checkedAt,
        notes: Object.freeze([...notes]),
      }),
    });
  }

  private validateOrCreateBinding(
    occurredAt: string,
    storageInstance: StorageInstance,
    target: NormalizedSharedStorageTarget,
    binding: { readonly absolutePath: string; readonly backendBindingReferenceId: string },
    allowCreate: boolean,
  ): StorageProvisioningReceipt {
    const exists = this.filesystem.exists(binding.absolutePath);
    if (!exists) {
      if (allowCreate && target.createBindingPathIfMissing) {
        this.filesystem.ensureDirectory(binding.absolutePath);
        return this.successReceipt(
          StorageProvisioningOperationStatuses.accepted,
          occurredAt,
          binding.backendBindingReferenceId,
          SharedStorageProvisioningReasonCodes.bindingCreated,
          "Shared storage binding directory created by server policy.",
        );
      }
      if (target.requiresExistingBindingPath) {
        return this.rejectedReceipt(
          occurredAt,
          SharedStorageProvisioningReasonCodes.bindingMissing,
          "Shared storage binding path is not reachable.",
        );
      }
      return this.successReceipt(
        StorageProvisioningOperationStatuses.accepted,
        occurredAt,
        binding.backendBindingReferenceId,
        SharedStorageProvisioningReasonCodes.bindingValidated,
        "Shared storage binding accepted without pre-existing path requirement.",
      );
    }

    if (!this.filesystem.isDirectory(binding.absolutePath)) {
      return this.rejectedReceipt(
        occurredAt,
        SharedStorageProvisioningReasonCodes.bindingPathConflict,
        "Shared storage binding path exists but is not a directory.",
      );
    }

    if (!this.filesystem.canRead(binding.absolutePath)) {
      return this.rejectedReceipt(
        occurredAt,
        SharedStorageProvisioningReasonCodes.bindingPermissionDenied,
        "Shared storage binding is not readable by the server runtime.",
      );
    }

    if (this.requiresWriteAccess(storageInstance, target) && !this.filesystem.canWrite(binding.absolutePath)) {
      return this.rejectedReceipt(
        occurredAt,
        SharedStorageProvisioningReasonCodes.bindingPermissionDenied,
        "Shared storage binding requires write access but runtime write permission is unavailable.",
      );
    }

    return this.successReceipt(
      StorageProvisioningOperationStatuses.accepted,
      occurredAt,
      binding.backendBindingReferenceId,
      SharedStorageProvisioningReasonCodes.bindingValidated,
      "Shared storage binding validated.",
    );
  }

  private resolveTarget(
    storageInstance: StorageInstance,
  ):
    | { readonly ok: true; readonly target: NormalizedSharedStorageTarget }
    | { readonly ok: false; readonly reasonCode: SharedStorageProvisioningReasonCode; readonly message: string } {
    const labelTarget = storageInstance.policy.labels[this.targetLabelKey]?.trim();
    const defaultTarget = this.defaultTargetIdByWorkspace[storageInstance.ownership.workspaceId]?.trim();
    const resolvedTargetId = labelTarget || defaultTarget;
    if (!resolvedTargetId) {
      return {
        ok: false,
        reasonCode: SharedStorageProvisioningReasonCodes.targetUnspecified,
        message: `Shared storage target is required through policy label '${this.targetLabelKey}' or workspace default mapping.`,
      };
    }

    const target = this.targetsById.get(resolvedTargetId);
    if (!target) {
      return {
        ok: false,
        reasonCode: SharedStorageProvisioningReasonCodes.targetUnknown,
        message: `Shared storage target '${resolvedTargetId}' is not configured on this server.`,
      };
    }

    if (target.allowedWorkspaceIds && !target.allowedWorkspaceIds.has(storageInstance.ownership.workspaceId)) {
      return {
        ok: false,
        reasonCode: SharedStorageProvisioningReasonCodes.targetWorkspaceNotAllowed,
        message: "Shared storage target is not available for the storage workspace.",
      };
    }

    return {
      ok: true,
      target,
    };
  }

  private resolveBinding(
    storageInstance: StorageInstance,
    target: NormalizedSharedStorageTarget,
  ): { readonly absolutePath: string; readonly backendBindingReferenceId: string } {
    const workspaceSegment = this.toSafePathSegment(storageInstance.ownership.workspaceId);
    const storageSegment = this.toSafePathSegment(storageInstance.id);

    let absolutePath = target.absolutePath;
    switch (target.sharedPathStrategy) {
      case "workspace-storage":
        absolutePath = path.join(target.absolutePath, "workspaces", workspaceSegment, "storage", storageSegment);
        break;
      case "workspace-only":
        absolutePath = path.join(target.absolutePath, "workspaces", workspaceSegment);
        break;
      case "none":
        absolutePath = target.absolutePath;
        break;
    }

    return Object.freeze({
      absolutePath,
      backendBindingReferenceId: `${this.backendBindingReferencePrefix}:${target.targetId}:${storageInstance.ownership.workspaceId}:${storageInstance.id}`,
    });
  }

  private validateStorageCompatibility(
    storageInstance: StorageInstance,
    target: NormalizedSharedStorageTarget,
  ): string | undefined {
    if (target.readOnly && storageInstance.access.mode !== StorageAccessModes.readOnly) {
      return "Shared storage target is read-only and cannot satisfy requested storage access mode.";
    }

    if (
      storageInstance.access.mode === StorageAccessModes.readOnly
      && !target.compatibility.supportsReadOnlyActive
      && storageInstance.lifecycleState === "active"
    ) {
      return "Shared storage target does not support active read-only storage instances.";
    }

    if (storageInstance.policy.allowCrossWorkspaceReads && !target.compatibility.supportsCrossWorkspaceReads) {
      return "Shared storage target does not allow cross-workspace read posture required by storage policy.";
    }

    if (!this.replicationModeSupported(storageInstance.replication.mode, target)) {
      return "Shared storage target does not support the requested replication mode.";
    }

    if (
      storageInstance.replication.mode === StorageReplicationModes.asyncMirror
      && target.compatibility.minReplicationSyncIntervalSeconds !== undefined
      && storageInstance.replication.syncIntervalSeconds !== undefined
      && storageInstance.replication.syncIntervalSeconds < target.compatibility.minReplicationSyncIntervalSeconds
    ) {
      return "Shared storage replication sync interval is lower than target minimum requirement.";
    }

    if (
      target.compatibility.maxObjectBytesLimit !== undefined
      && storageInstance.policy.maxObjectBytes !== undefined
      && storageInstance.policy.maxObjectBytes > target.compatibility.maxObjectBytesLimit
    ) {
      return "Shared storage policy maxObjectBytes exceeds target object-size capability.";
    }

    return undefined;
  }

  private replicationModeSupported(
    replicationMode: StorageReplicationMode,
    target: NormalizedSharedStorageTarget,
  ): boolean {
    if (replicationMode === StorageReplicationModes.none) {
      return true;
    }
    if (replicationMode === StorageReplicationModes.asyncMirror) {
      return target.compatibility.supportsAsyncReplication;
    }
    return target.compatibility.supportsSyncReplication;
  }

  private requiresWriteAccess(storageInstance: StorageInstance, target: NormalizedSharedStorageTarget): boolean {
    if (target.readOnly) {
      return false;
    }
    return storageInstance.access.mode !== StorageAccessModes.readOnly;
  }

  private normalizeTarget(input: SharedStorageTargetDefinition): NormalizedSharedStorageTarget {
    const targetId = input.targetId.trim();
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(targetId)) {
      throw new Error("Shared storage targetId must be lowercase alphanumeric with optional '-' and 2-64 characters.");
    }

    const absolutePath = input.absolutePath.trim();
    if (!absolutePath) {
      throw new Error(`Shared storage target '${targetId}' requires absolutePath.`);
    }

    const normalizedPath = path.resolve(absolutePath);
    const maxObjectBytesLimit = input.compatibility?.maxObjectBytesLimit;
    if (maxObjectBytesLimit !== undefined && (!Number.isInteger(maxObjectBytesLimit) || maxObjectBytesLimit < 1)) {
      throw new Error(`Shared storage target '${targetId}' maxObjectBytesLimit must be an integer >= 1 when provided.`);
    }

    const minReplicationSyncIntervalSeconds = input.compatibility?.minReplicationSyncIntervalSeconds;
    if (
      minReplicationSyncIntervalSeconds !== undefined
      && (!Number.isInteger(minReplicationSyncIntervalSeconds) || minReplicationSyncIntervalSeconds < 10)
    ) {
      throw new Error(
        `Shared storage target '${targetId}' minReplicationSyncIntervalSeconds must be an integer >= 10 when provided.`,
      );
    }

    const capabilityTags = Object.freeze(
      [...new Set((input.compatibility?.capabilityTags ?? [])
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(entry)))],
    );

    const allowedWorkspaceIds = input.allowedWorkspaceIds
      ? Object.freeze(new Set(input.allowedWorkspaceIds.map((workspaceId) => workspaceId.trim()).filter((workspaceId) => workspaceId)))
      : undefined;

    return Object.freeze({
      targetId,
      absolutePath: normalizedPath,
      readOnly: input.readOnly ?? false,
      allowedWorkspaceIds,
      requiresExistingBindingPath: input.requiresExistingBindingPath ?? true,
      createBindingPathIfMissing: input.createBindingPathIfMissing ?? false,
      sharedPathStrategy: input.sharedPathStrategy ?? "workspace-storage",
      compatibility: {
        supportsReadOnlyActive: input.compatibility?.supportsReadOnlyActive ?? true,
        supportsCrossWorkspaceReads: input.compatibility?.supportsCrossWorkspaceReads ?? false,
        supportsAsyncReplication: input.compatibility?.supportsAsyncReplication ?? false,
        supportsSyncReplication: input.compatibility?.supportsSyncReplication ?? false,
        maxObjectBytesLimit,
        minReplicationSyncIntervalSeconds,
        capabilityTags,
      },
    });
  }

  private toSafePathSegment(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const hash = createHash("sha256").update(value).digest("hex").slice(0, 12);
    return `${normalized || "id"}-${hash}`;
  }

  private successReceipt(
    status: StorageProvisioningReceipt["status"],
    occurredAt: string,
    backendRequestId: string,
    reasonCode: SharedStorageProvisioningReasonCode,
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
    reasonCode: SharedStorageProvisioningReasonCode,
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

