export class StorageDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageDomainError";
  }
}

export class StorageLifecycleTransitionError extends StorageDomainError {
  constructor(fromState: StorageLifecycleState, toState: StorageLifecycleState) {
    super(`Storage lifecycle cannot transition from '${fromState}' to '${toState}'.`);
    this.name = "StorageLifecycleTransitionError";
  }
}

export const StorageBackendTypes = Object.freeze({
  managedFilesystem: "managed-filesystem",
  objectStorage: "object-storage",
  networkShare: "network-share",
});

export type StorageBackendType = typeof StorageBackendTypes[keyof typeof StorageBackendTypes];

export const StorageAccessModes = Object.freeze({
  readWrite: "read-write",
  readOnly: "read-only",
  appendOnly: "append-only",
});

export type StorageAccessMode = typeof StorageAccessModes[keyof typeof StorageAccessModes];

export const StorageAccessScopes = Object.freeze({
  workspace: "workspace",
  workspaceMembers: "workspace-members",
  platformManaged: "platform-managed",
});

export type StorageAccessScope = typeof StorageAccessScopes[keyof typeof StorageAccessScopes];

export const StorageLifecycleStates = Object.freeze({
  provisioning: "provisioning",
  active: "active",
  suspended: "suspended",
  degraded: "degraded",
  archived: "archived",
  deleting: "deleting",
  deleted: "deleted",
  failed: "failed",
});

export type StorageLifecycleState = typeof StorageLifecycleStates[keyof typeof StorageLifecycleStates];

export const StorageReplicationModes = Object.freeze({
  none: "none",
  asyncMirror: "async-mirror",
  syncMirror: "sync-mirror",
});

export type StorageReplicationMode = typeof StorageReplicationModes[keyof typeof StorageReplicationModes];

export const StorageEncryptionModes = Object.freeze({
  none: "none",
  platformManaged: "platform-managed",
  customerManaged: "customer-managed",
});

export type StorageEncryptionMode = typeof StorageEncryptionModes[keyof typeof StorageEncryptionModes];

export const StorageEncryptionKeyScopes = Object.freeze({
  workspace: "workspace",
  storageInstance: "storage-instance",
  platform: "platform",
});

export type StorageEncryptionKeyScope = typeof StorageEncryptionKeyScopes[keyof typeof StorageEncryptionKeyScopes];

export const StorageRetentionExpiryActions = Object.freeze({
  none: "none",
  archive: "archive",
  delete: "delete",
});

export type StorageRetentionExpiryAction =
  typeof StorageRetentionExpiryActions[keyof typeof StorageRetentionExpiryActions];

export interface StorageOwnership {
  readonly workspaceId: string;
  readonly ownerUserIdentityId: string;
}

export interface StorageAttribution {
  readonly actorUserIdentityId: string;
  readonly occurredAt: string;
  readonly correlationId: string;
}

export interface StorageEncryptionPostureReference {
  readonly profileId: string;
  readonly keyReferenceId?: string;
  readonly envelopeRequired: boolean;
}

export interface StorageReplicationPolicy {
  readonly mode: StorageReplicationMode;
  readonly replicaStorageInstanceId?: string;
  readonly syncIntervalSeconds?: number;
}

export interface StoragePolicySecuritySettings {
  readonly encryptionMode: StorageEncryptionMode;
  readonly contentEncryptionRequired: boolean;
  readonly keyScope: StorageEncryptionKeyScope;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}

export interface StoragePolicyLifecycleSettings {
  readonly retentionExpiryAction: StorageRetentionExpiryAction;
  readonly purgeGracePeriodDays?: number;
}

export interface StoragePolicy {
  readonly policyId: string;
  readonly maxObjectBytes?: number;
  readonly retentionDays?: number;
  readonly immutableWrites: boolean;
  readonly allowCrossWorkspaceReads: boolean;
  readonly labels: Readonly<Record<string, string>>;
  readonly encryption: StorageEncryptionPostureReference;
  readonly security: StoragePolicySecuritySettings;
  readonly lifecycle: StoragePolicyLifecycleSettings;
}

export interface StorageAccessPolicy {
  readonly mode: StorageAccessMode;
  readonly scope: StorageAccessScope;
}

export interface StorageInstance {
  readonly id: string;
  readonly displayName: string;
  readonly backendType: StorageBackendType;
  readonly lifecycleState: StorageLifecycleState;
  readonly ownership: StorageOwnership;
  readonly access: StorageAccessPolicy;
  readonly replication: StorageReplicationPolicy;
  readonly policy: StoragePolicy;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly lastModifiedBy: string;
  readonly lastModifiedAt: string;
  readonly lastCorrelationId: string;
}

export const StorageLifecycleTransitions: Readonly<Record<StorageLifecycleState, ReadonlyArray<StorageLifecycleState>>> =
  Object.freeze({
    [StorageLifecycleStates.provisioning]: Object.freeze([
      StorageLifecycleStates.active,
      StorageLifecycleStates.failed,
      StorageLifecycleStates.deleting,
    ]),
    [StorageLifecycleStates.active]: Object.freeze([
      StorageLifecycleStates.suspended,
      StorageLifecycleStates.degraded,
      StorageLifecycleStates.archived,
      StorageLifecycleStates.deleting,
    ]),
    [StorageLifecycleStates.suspended]: Object.freeze([
      StorageLifecycleStates.active,
      StorageLifecycleStates.archived,
      StorageLifecycleStates.deleting,
    ]),
    [StorageLifecycleStates.degraded]: Object.freeze([
      StorageLifecycleStates.active,
      StorageLifecycleStates.suspended,
      StorageLifecycleStates.failed,
      StorageLifecycleStates.deleting,
    ]),
    [StorageLifecycleStates.archived]: Object.freeze([
      StorageLifecycleStates.active,
      StorageLifecycleStates.deleting,
    ]),
    [StorageLifecycleStates.deleting]: Object.freeze([
      StorageLifecycleStates.deleted,
      StorageLifecycleStates.failed,
    ]),
    [StorageLifecycleStates.deleted]: Object.freeze([]),
    [StorageLifecycleStates.failed]: Object.freeze([
      StorageLifecycleStates.provisioning,
      StorageLifecycleStates.deleting,
      StorageLifecycleStates.archived,
    ]),
  });

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new StorageDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new StorageDomainError(`${field} must be a valid timestamp.`);
  }
  return date.toISOString();
}

function normalizeCorrelationId(value: string): string {
  const normalized = normalizeRequired(value, "Storage attribution correlationId");
  if (!/^[a-zA-Z0-9._:-]{6,256}$/.test(normalized)) {
    throw new StorageDomainError(
      "Storage attribution correlationId must be 6-256 characters using letters, numbers, '.', '_', ':', or '-'.",
    );
  }
  return normalized;
}

function normalizeStorageId(value: string): string {
  const normalized = normalizeRequired(value, "Storage instance id");
  if (!/^[a-z0-9][a-z0-9-]{2,126}$/.test(normalized)) {
    throw new StorageDomainError(
      "Storage instance id must be lowercase alphanumeric with optional '-' and 3-127 characters.",
    );
  }
  return normalized;
}

function normalizeDisplayName(value: string): string {
  const normalized = normalizeRequired(value, "Storage instance displayName");
  if (normalized.length < 3 || normalized.length > 120) {
    throw new StorageDomainError("Storage instance displayName must be between 3 and 120 characters.");
  }
  return normalized;
}

function normalizeBackendType(value: StorageBackendType): StorageBackendType {
  if (!Object.values(StorageBackendTypes).includes(value)) {
    throw new StorageDomainError(`Storage backend type '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeAccessMode(value: StorageAccessMode): StorageAccessMode {
  if (!Object.values(StorageAccessModes).includes(value)) {
    throw new StorageDomainError(`Storage access mode '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeAccessScope(value: StorageAccessScope): StorageAccessScope {
  if (!Object.values(StorageAccessScopes).includes(value)) {
    throw new StorageDomainError(`Storage access scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeLifecycleState(value?: StorageLifecycleState): StorageLifecycleState {
  const resolved = value ?? StorageLifecycleStates.provisioning;
  if (!Object.values(StorageLifecycleStates).includes(resolved)) {
    throw new StorageDomainError(`Storage lifecycle state '${String(value)}' is invalid.`);
  }
  return resolved;
}

function normalizeReplicationMode(value?: StorageReplicationMode): StorageReplicationMode {
  const resolved = value ?? StorageReplicationModes.none;
  if (!Object.values(StorageReplicationModes).includes(resolved)) {
    throw new StorageDomainError(`Storage replication mode '${String(value)}' is invalid.`);
  }
  return resolved;
}

function normalizeOwnership(input: StorageOwnership): StorageOwnership {
  return Object.freeze({
    workspaceId: normalizeRequired(input.workspaceId, "Storage ownership workspaceId"),
    ownerUserIdentityId: normalizeRequired(input.ownerUserIdentityId, "Storage ownership ownerUserIdentityId"),
  });
}

function normalizeAttribution(input: StorageAttribution): StorageAttribution {
  return Object.freeze({
    actorUserIdentityId: normalizeRequired(input.actorUserIdentityId, "Storage attribution actorUserIdentityId"),
    occurredAt: normalizeTimestamp(input.occurredAt, "Storage attribution occurredAt"),
    correlationId: normalizeCorrelationId(input.correlationId),
  });
}

export function createStorageAttribution(input: {
  readonly actorUserIdentityId: string;
  readonly occurredAt?: Date | string;
  readonly correlationId: string;
}): StorageAttribution {
  return Object.freeze({
    actorUserIdentityId: normalizeRequired(input.actorUserIdentityId, "Storage attribution actorUserIdentityId"),
    occurredAt: normalizeTimestamp(input.occurredAt ?? new Date(), "Storage attribution occurredAt"),
    correlationId: normalizeCorrelationId(input.correlationId),
  });
}

function normalizeEncryptionPosture(
  input: StorageEncryptionPostureReference,
  lifecycleState: StorageLifecycleState,
): StorageEncryptionPostureReference {
  const profileId = normalizeRequired(input.profileId, "Storage encryption profileId");
  const keyReferenceId = normalizeOptional(input.keyReferenceId);

  if (lifecycleState !== StorageLifecycleStates.deleted && !profileId) {
    throw new StorageDomainError("Storage encryption profileId is required for non-deleted storage instances.");
  }

  return Object.freeze({
    profileId,
    keyReferenceId,
    envelopeRequired: input.envelopeRequired,
  });
}

function normalizeEncryptionMode(value?: StorageEncryptionMode): StorageEncryptionMode {
  const resolved = value ?? StorageEncryptionModes.platformManaged;
  if (!Object.values(StorageEncryptionModes).includes(resolved)) {
    throw new StorageDomainError(`Storage policy encryptionMode '${String(value)}' is invalid.`);
  }
  return resolved;
}

function normalizeEncryptionKeyScope(value?: StorageEncryptionKeyScope): StorageEncryptionKeyScope {
  const resolved = value ?? StorageEncryptionKeyScopes.workspace;
  if (!Object.values(StorageEncryptionKeyScopes).includes(resolved)) {
    throw new StorageDomainError(`Storage policy keyScope '${String(value)}' is invalid.`);
  }
  return resolved;
}

function normalizeRetentionExpiryAction(value?: StorageRetentionExpiryAction): StorageRetentionExpiryAction {
  const resolved = value ?? StorageRetentionExpiryActions.none;
  if (!Object.values(StorageRetentionExpiryActions).includes(resolved)) {
    throw new StorageDomainError(`Storage policy retentionExpiryAction '${String(value)}' is invalid.`);
  }
  return resolved;
}

function normalizeStoragePolicySecurity(
  input: {
    readonly encryptionMode?: StorageEncryptionMode;
    readonly contentEncryptionRequired?: boolean;
    readonly keyScope?: StorageEncryptionKeyScope;
    readonly allowPreviewDecryption?: boolean;
    readonly allowWorkerDecryption?: boolean;
  } | undefined,
  encryption: StorageEncryptionPostureReference,
): StoragePolicySecuritySettings {
  const encryptionMode = normalizeEncryptionMode(input?.encryptionMode);
  const contentEncryptionRequired = input?.contentEncryptionRequired ?? true;
  const keyScope = normalizeEncryptionKeyScope(input?.keyScope);
  const allowPreviewDecryption = input?.allowPreviewDecryption ?? false;
  const allowWorkerDecryption = input?.allowWorkerDecryption ?? false;

  if (encryptionMode === StorageEncryptionModes.none) {
    if (contentEncryptionRequired) {
      throw new StorageDomainError(
        "Storage policy encryptionMode 'none' cannot require content encryption.",
      );
    }
    if (encryption.envelopeRequired) {
      throw new StorageDomainError("Storage policy encryptionMode 'none' cannot require envelope encryption.");
    }
    if (encryption.keyReferenceId) {
      throw new StorageDomainError("Storage policy encryptionMode 'none' cannot define encryption key references.");
    }
    if (allowPreviewDecryption || allowWorkerDecryption) {
      throw new StorageDomainError("Storage policy encryptionMode 'none' cannot allow preview or worker decryption.");
    }
  } else {
    if (!contentEncryptionRequired) {
      throw new StorageDomainError(
        `Storage policy encryptionMode '${encryptionMode}' requires contentEncryptionRequired=true.`,
      );
    }
  }

  if (encryptionMode === StorageEncryptionModes.customerManaged && !encryption.keyReferenceId) {
    throw new StorageDomainError(
      "Storage policy encryptionMode 'customer-managed' requires encryption keyReferenceId.",
    );
  }

  if (encryptionMode === StorageEncryptionModes.platformManaged && encryption.keyReferenceId) {
    throw new StorageDomainError(
      "Storage policy encryptionMode 'platform-managed' cannot define encryption keyReferenceId.",
    );
  }

  if (keyScope === StorageEncryptionKeyScopes.platform && encryptionMode === StorageEncryptionModes.customerManaged) {
    throw new StorageDomainError("Storage policy customer-managed encryption cannot use platform key scope.");
  }

  if (!contentEncryptionRequired && (allowPreviewDecryption || allowWorkerDecryption)) {
    throw new StorageDomainError(
      "Storage policy cannot allow decryption when contentEncryptionRequired=false.",
    );
  }

  return Object.freeze({
    encryptionMode,
    contentEncryptionRequired,
    keyScope,
    allowPreviewDecryption,
    allowWorkerDecryption,
  });
}

function normalizeStoragePolicyLifecycle(
  input: {
    readonly retentionExpiryAction?: StorageRetentionExpiryAction;
    readonly purgeGracePeriodDays?: number;
  } | undefined,
  retentionDays?: number,
): StoragePolicyLifecycleSettings {
  const retentionExpiryAction = normalizeRetentionExpiryAction(input?.retentionExpiryAction);
  const purgeGracePeriodDays = input?.purgeGracePeriodDays;

  if (retentionExpiryAction !== StorageRetentionExpiryActions.none && retentionDays === undefined) {
    throw new StorageDomainError(
      `Storage policy retentionExpiryAction '${retentionExpiryAction}' requires retentionDays.`,
    );
  }

  if (purgeGracePeriodDays !== undefined) {
    if (!Number.isInteger(purgeGracePeriodDays) || purgeGracePeriodDays < 1) {
      throw new StorageDomainError(
        "Storage policy lifecycle purgeGracePeriodDays must be an integer >= 1 when provided.",
      );
    }

    if (retentionExpiryAction !== StorageRetentionExpiryActions.delete) {
      throw new StorageDomainError(
        "Storage policy lifecycle purgeGracePeriodDays is only valid when retentionExpiryAction='delete'.",
      );
    }
  }

  return Object.freeze({
    retentionExpiryAction,
    purgeGracePeriodDays,
  });
}

function normalizeLabels(
  labels?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels ?? {})) {
    const normalizedKey = key.trim();
    const normalizedValue = value.trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }

    if (!/^[a-zA-Z0-9._:-]{1,64}$/.test(normalizedKey)) {
      throw new StorageDomainError(`Storage policy label key '${normalizedKey}' is invalid.`);
    }

    if (normalizedValue.length > 256) {
      throw new StorageDomainError(`Storage policy label '${normalizedKey}' must be 256 characters or fewer.`);
    }

    normalized[normalizedKey] = normalizedValue;
  }

  return Object.freeze(normalized);
}

export function createStoragePolicy(input: {
  readonly policyId: string;
  readonly maxObjectBytes?: number;
  readonly retentionDays?: number;
  readonly immutableWrites?: boolean;
  readonly allowCrossWorkspaceReads?: boolean;
  readonly labels?: Readonly<Record<string, string>>;
  readonly encryption: StorageEncryptionPostureReference;
  readonly security?: {
    readonly encryptionMode?: StorageEncryptionMode;
    readonly contentEncryptionRequired?: boolean;
    readonly keyScope?: StorageEncryptionKeyScope;
    readonly allowPreviewDecryption?: boolean;
    readonly allowWorkerDecryption?: boolean;
  };
  readonly lifecycle?: {
    readonly retentionExpiryAction?: StorageRetentionExpiryAction;
    readonly purgeGracePeriodDays?: number;
  };
  readonly lifecycleState?: StorageLifecycleState;
}): StoragePolicy {
  if (input.maxObjectBytes !== undefined) {
    if (!Number.isInteger(input.maxObjectBytes) || input.maxObjectBytes < 1) {
      throw new StorageDomainError("Storage policy maxObjectBytes must be an integer >= 1 when provided.");
    }
  }

  if (input.retentionDays !== undefined) {
    if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1) {
      throw new StorageDomainError("Storage policy retentionDays must be an integer >= 1 when provided.");
    }
  }

  const lifecycleState = normalizeLifecycleState(input.lifecycleState);
  const encryption = normalizeEncryptionPosture(input.encryption, lifecycleState);
  const security = normalizeStoragePolicySecurity(input.security, encryption);
  const lifecycle = normalizeStoragePolicyLifecycle(input.lifecycle, input.retentionDays);

  return Object.freeze({
    policyId: normalizeRequired(input.policyId, "Storage policy policyId"),
    maxObjectBytes: input.maxObjectBytes,
    retentionDays: input.retentionDays,
    immutableWrites: input.immutableWrites ?? false,
    allowCrossWorkspaceReads: input.allowCrossWorkspaceReads ?? false,
    labels: normalizeLabels(input.labels),
    encryption,
    security,
    lifecycle,
  });
}

export function createStorageReplicationPolicy(input?: {
  readonly mode?: StorageReplicationMode;
  readonly replicaStorageInstanceId?: string;
  readonly syncIntervalSeconds?: number;
}): StorageReplicationPolicy {
  const mode = normalizeReplicationMode(input?.mode);
  const replicaStorageInstanceId = normalizeOptional(input?.replicaStorageInstanceId);

  if (mode === StorageReplicationModes.none) {
    if (replicaStorageInstanceId || input?.syncIntervalSeconds !== undefined) {
      throw new StorageDomainError(
        "Storage replication mode 'none' cannot include replicaStorageInstanceId or syncIntervalSeconds.",
      );
    }
  } else {
    if (!replicaStorageInstanceId) {
      throw new StorageDomainError(
        `Storage replication mode '${mode}' requires replicaStorageInstanceId.`,
      );
    }

    if (input?.syncIntervalSeconds !== undefined) {
      if (!Number.isInteger(input.syncIntervalSeconds) || input.syncIntervalSeconds < 10) {
        throw new StorageDomainError(
          "Storage replication syncIntervalSeconds must be an integer >= 10 when provided.",
        );
      }
    }

    if (mode === StorageReplicationModes.syncMirror && input?.syncIntervalSeconds !== undefined) {
      throw new StorageDomainError("Synchronous replication cannot define syncIntervalSeconds.");
    }

    if (mode === StorageReplicationModes.asyncMirror && input?.syncIntervalSeconds === undefined) {
      throw new StorageDomainError("Asynchronous replication requires syncIntervalSeconds.");
    }
  }

  return Object.freeze({
    mode,
    replicaStorageInstanceId,
    syncIntervalSeconds: input?.syncIntervalSeconds,
  });
}

function assertStorageStateInvariant(instance: StorageInstance): void {
  if (instance.lifecycleState === StorageLifecycleStates.deleted) {
    if (instance.replication.mode !== StorageReplicationModes.none) {
      throw new StorageDomainError("Deleted storage instances cannot retain active replication configuration.");
    }
    return;
  }

  if (instance.lifecycleState === StorageLifecycleStates.archived && instance.access.scope === StorageAccessScopes.platformManaged) {
    throw new StorageDomainError("Archived storage instances cannot use platform-managed access scope.");
  }

  if (
    instance.lifecycleState === StorageLifecycleStates.active
    && instance.access.mode === StorageAccessModes.readOnly
    && instance.replication.mode === StorageReplicationModes.none
  ) {
    throw new StorageDomainError(
      "Active read-only storage instances must be replication-backed to avoid stale standalone mirrors.",
    );
  }
}

function normalizeAccess(input: StorageAccessPolicy): StorageAccessPolicy {
  const mode = normalizeAccessMode(input.mode);
  const scope = normalizeAccessScope(input.scope);
  if (mode === StorageAccessModes.appendOnly && scope === StorageAccessScopes.workspace) {
    throw new StorageDomainError("Append-only storage access cannot be scoped to single-workspace private access.");
  }
  return Object.freeze({ mode, scope });
}

function isStorageTransitionAllowed(from: StorageLifecycleState, to: StorageLifecycleState): boolean {
  if (from === to) {
    return true;
  }
  return StorageLifecycleTransitions[from].includes(to);
}

export function createStorageInstance(input: {
  readonly id: string;
  readonly displayName: string;
  readonly backendType: StorageBackendType;
  readonly ownership: StorageOwnership;
  readonly access: StorageAccessPolicy;
  readonly replication?: {
    readonly mode?: StorageReplicationMode;
    readonly replicaStorageInstanceId?: string;
    readonly syncIntervalSeconds?: number;
  };
  readonly policy: Omit<Parameters<typeof createStoragePolicy>[0], "lifecycleState">;
  readonly lifecycleState?: StorageLifecycleState;
  readonly createdBy: string;
  readonly createdAt?: Date | string;
  readonly lastModifiedBy?: string;
  readonly lastModifiedAt?: Date | string;
  readonly lastCorrelationId: string;
}): StorageInstance {
  const lifecycleState = normalizeLifecycleState(input.lifecycleState);
  const createdAt = normalizeTimestamp(input.createdAt ?? new Date(), "Storage createdAt");
  const lastModifiedAt = normalizeTimestamp(input.lastModifiedAt ?? createdAt, "Storage lastModifiedAt");

  if (new Date(lastModifiedAt).getTime() < new Date(createdAt).getTime()) {
    throw new StorageDomainError("Storage lastModifiedAt cannot be earlier than createdAt.");
  }

  const instance: StorageInstance = Object.freeze({
    id: normalizeStorageId(input.id),
    displayName: normalizeDisplayName(input.displayName),
    backendType: normalizeBackendType(input.backendType),
    lifecycleState,
    ownership: normalizeOwnership(input.ownership),
    access: normalizeAccess(input.access),
    replication: createStorageReplicationPolicy(input.replication),
    policy: createStoragePolicy({ ...input.policy, lifecycleState }),
    createdBy: normalizeRequired(input.createdBy, "Storage createdBy"),
    createdAt,
    lastModifiedBy: normalizeRequired(input.lastModifiedBy ?? input.createdBy, "Storage lastModifiedBy"),
    lastModifiedAt,
    lastCorrelationId: normalizeCorrelationId(input.lastCorrelationId),
  });

  assertStorageStateInvariant(instance);
  return instance;
}

export function transitionStorageLifecycle(
  instance: StorageInstance,
  nextState: StorageLifecycleState,
  attribution: StorageAttribution,
): StorageInstance {
  const normalizedAttribution = normalizeAttribution(attribution);
  const normalizedState = normalizeLifecycleState(nextState);
  if (!isStorageTransitionAllowed(instance.lifecycleState, normalizedState)) {
    throw new StorageLifecycleTransitionError(instance.lifecycleState, normalizedState);
  }

  if (instance.lifecycleState === normalizedState) {
    return instance;
  }

  const transitioned: StorageInstance = Object.freeze({
    ...instance,
    lifecycleState: normalizedState,
    policy: createStoragePolicy({
      ...instance.policy,
      lifecycleState: normalizedState,
    }),
    lastModifiedBy: normalizedAttribution.actorUserIdentityId,
    lastModifiedAt: normalizedAttribution.occurredAt,
    lastCorrelationId: normalizedAttribution.correlationId,
  });

  assertStorageStateInvariant(transitioned);
  return transitioned;
}

export function updateStoragePolicy(
  instance: StorageInstance,
  input: {
    readonly maxObjectBytes?: number;
    readonly retentionDays?: number;
    readonly immutableWrites?: boolean;
    readonly allowCrossWorkspaceReads?: boolean;
    readonly labels?: Readonly<Record<string, string>>;
    readonly encryption?: StorageEncryptionPostureReference;
    readonly security?: {
      readonly encryptionMode?: StorageEncryptionMode;
      readonly contentEncryptionRequired?: boolean;
      readonly keyScope?: StorageEncryptionKeyScope;
      readonly allowPreviewDecryption?: boolean;
      readonly allowWorkerDecryption?: boolean;
    };
    readonly lifecycle?: {
      readonly retentionExpiryAction?: StorageRetentionExpiryAction;
      readonly purgeGracePeriodDays?: number;
    };
  },
  attribution: StorageAttribution,
): StorageInstance {
  const normalizedAttribution = normalizeAttribution(attribution);
  const nextPolicy = createStoragePolicy({
    policyId: instance.policy.policyId,
    maxObjectBytes: input.maxObjectBytes ?? instance.policy.maxObjectBytes,
    retentionDays: input.retentionDays ?? instance.policy.retentionDays,
    immutableWrites: input.immutableWrites ?? instance.policy.immutableWrites,
    allowCrossWorkspaceReads: input.allowCrossWorkspaceReads ?? instance.policy.allowCrossWorkspaceReads,
    labels: input.labels ?? instance.policy.labels,
    encryption: input.encryption ?? instance.policy.encryption,
    security: {
      encryptionMode: input.security?.encryptionMode ?? instance.policy.security.encryptionMode,
      contentEncryptionRequired: input.security?.contentEncryptionRequired ?? instance.policy.security.contentEncryptionRequired,
      keyScope: input.security?.keyScope ?? instance.policy.security.keyScope,
      allowPreviewDecryption: input.security?.allowPreviewDecryption ?? instance.policy.security.allowPreviewDecryption,
      allowWorkerDecryption: input.security?.allowWorkerDecryption ?? instance.policy.security.allowWorkerDecryption,
    },
    lifecycle: {
      retentionExpiryAction: input.lifecycle?.retentionExpiryAction ?? instance.policy.lifecycle.retentionExpiryAction,
      purgeGracePeriodDays: input.lifecycle?.purgeGracePeriodDays ?? instance.policy.lifecycle.purgeGracePeriodDays,
    },
    lifecycleState: instance.lifecycleState,
  });

  const updated: StorageInstance = Object.freeze({
    ...instance,
    policy: nextPolicy,
    lastModifiedBy: normalizedAttribution.actorUserIdentityId,
    lastModifiedAt: normalizedAttribution.occurredAt,
    lastCorrelationId: normalizedAttribution.correlationId,
  });

  assertStorageStateInvariant(updated);
  return updated;
}

export function isStorageInstanceActive(instance: StorageInstance): boolean {
  return instance.lifecycleState === StorageLifecycleStates.active;
}

export function assertStorageInstanceActive(instance: StorageInstance): void {
  if (!isStorageInstanceActive(instance)) {
    throw new StorageDomainError(
      `Storage instance '${instance.id}' is not active (current state: '${instance.lifecycleState}').`,
    );
  }
}
