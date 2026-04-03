import type { CanonicalRecordValue } from "../dataset-studio/CanonicalDataShapes";

export const DatasetInstanceRoles = Object.freeze({
  inputStore: "input-store",
  outputStore: "output-store",
  intermediateStore: "intermediate-store",
} as const);

export type DatasetInstanceRole = typeof DatasetInstanceRoles[keyof typeof DatasetInstanceRoles];

export const DatasetInstanceLifecycleStatuses = Object.freeze({
  provisioning: "provisioning",
  ready: "ready",
  archived: "archived",
  failed: "failed",
} as const);

export type DatasetInstanceLifecycleStatus =
  typeof DatasetInstanceLifecycleStatuses[keyof typeof DatasetInstanceLifecycleStatuses];

export const DatasetInstanceRuntimeStatuses = Object.freeze({
  idle: "idle",
  ingesting: "ingesting",
  processing: "processing",
  unavailable: "unavailable",
} as const);

export type DatasetInstanceRuntimeStatus =
  typeof DatasetInstanceRuntimeStatuses[keyof typeof DatasetInstanceRuntimeStatuses];

export const DatasetInstanceRetentionPolicies = Object.freeze({
  manual: "manual",
  ttl: "ttl",
} as const);

export type DatasetInstanceRetentionPolicy =
  typeof DatasetInstanceRetentionPolicies[keyof typeof DatasetInstanceRetentionPolicies];

export const DatasetInstanceCleanupStatuses = Object.freeze({
  pending: "pending",
  completed: "completed",
} as const);

export type DatasetInstanceCleanupStatus =
  typeof DatasetInstanceCleanupStatuses[keyof typeof DatasetInstanceCleanupStatuses];

export interface DatasetInstanceLifecycleMetadata {
  readonly retentionPolicy?: DatasetInstanceRetentionPolicy;
  readonly maxAgeDays?: number;
  readonly cleanupAfter?: string;
  readonly cleanupStatus?: DatasetInstanceCleanupStatus;
}

export interface DatasetInstanceStorageBinding {
  readonly storageInstanceId: string;
  readonly storageInstanceRef: string;
  readonly bindingArea: "input" | "output" | "intermediate";
  readonly bindingId: string;
  readonly bindingReference: string;
}

export interface DatasetInstance {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: DatasetInstanceRole;
  readonly purpose?: string;
  readonly lifecycleStatus: DatasetInstanceLifecycleStatus;
  readonly runtimeStatus: DatasetInstanceRuntimeStatus;
  readonly storageBinding?: DatasetInstanceStorageBinding;
  readonly seedMetadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly lifecycleMetadata?: DatasetInstanceLifecycleMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DatasetInstancePatch {
  readonly datasetAssetVersionId?: string | null;
  readonly purpose?: string | null;
  readonly lifecycleStatus?: DatasetInstanceLifecycleStatus;
  readonly runtimeStatus?: DatasetInstanceRuntimeStatus;
  readonly storageBinding?: DatasetInstanceStorageBinding | null;
  readonly seedMetadata?: Readonly<Record<string, CanonicalRecordValue>> | null;
  readonly lifecycleMetadata?: DatasetInstanceLifecycleMetadata | null;
  readonly updatedAt?: string;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeSeedMetadata(
  value?: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, entry]) => [key.trim(), entry] as const)
    .filter(([key]) => key.length > 0);
  if (entries.length === 0) {
    return undefined;
  }
  return Object.freeze(Object.fromEntries(entries));
}

function normalizeStorageBinding(value?: DatasetInstanceStorageBinding): DatasetInstanceStorageBinding | undefined {
  if (!value) {
    return undefined;
  }

  const storageInstanceId = normalizeRequired(value.storageInstanceId, "Dataset instance storage binding storageInstanceId");
  const storageInstanceRef = normalizeRequired(value.storageInstanceRef, "Dataset instance storage binding storageInstanceRef");
  const bindingId = normalizeRequired(value.bindingId, "Dataset instance storage binding bindingId");
  const bindingReference = normalizeRequired(value.bindingReference, "Dataset instance storage binding bindingReference");
  const bindingArea = value.bindingArea;
  if (bindingArea !== "input" && bindingArea !== "output" && bindingArea !== "intermediate") {
    throw new Error(`Dataset instance storage binding area '${String(bindingArea)}' is not supported.`);
  }
  const forbiddenPathToken = (candidate: string): boolean =>
    candidate.includes("/")
    || candidate.includes("\\")
    || candidate.toLowerCase().includes("path")
    || candidate.toLowerCase().includes("directory")
    || candidate.toLowerCase().includes("filesystem");
  if (forbiddenPathToken(storageInstanceId) || forbiddenPathToken(bindingId)) {
    throw new Error("Dataset instance storage bindings must use storage-instance identities and logical binding ids, not path-like values.");
  }
  if (!storageInstanceRef.startsWith("storage-instance://") || !bindingReference.startsWith("storage-instance://")) {
    throw new Error("Dataset instance storage bindings must use storage-instance:// logical references.");
  }

  return Object.freeze({
    storageInstanceId,
    storageInstanceRef,
    bindingArea,
    bindingId,
    bindingReference,
  });
}

function normalizeTimestamp(value: string | undefined, label: string): string {
  const normalized = normalizeOptional(value) ?? new Date().toISOString();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return normalized;
}

function normalizePatchTimestamp(input?: string): string {
  return normalizeTimestamp(input, "DatasetInstance.updatedAt");
}

function normalizeRole(value: DatasetInstanceRole): DatasetInstanceRole {
  if (Object.values(DatasetInstanceRoles).includes(value)) {
    return value;
  }
  throw new Error(`Dataset instance role '${value}' is not supported.`);
}

function normalizeLifecycleStatus(value: DatasetInstanceLifecycleStatus): DatasetInstanceLifecycleStatus {
  if (Object.values(DatasetInstanceLifecycleStatuses).includes(value)) {
    return value;
  }
  throw new Error(`Dataset instance lifecycle status '${value}' is not supported.`);
}

function normalizeRuntimeStatus(value: DatasetInstanceRuntimeStatus): DatasetInstanceRuntimeStatus {
  if (Object.values(DatasetInstanceRuntimeStatuses).includes(value)) {
    return value;
  }
  throw new Error(`Dataset instance runtime status '${value}' is not supported.`);
}

function normalizeLifecycleMetadata(
  value?: DatasetInstanceLifecycleMetadata,
): DatasetInstanceLifecycleMetadata | undefined {
  if (!value) {
    return undefined;
  }

  const retentionPolicy = value.retentionPolicy
    ? normalizeRetentionPolicy(value.retentionPolicy)
    : undefined;
  const maxAgeDays = normalizeMaxAgeDays(value.maxAgeDays);
  const cleanupAfter = value.cleanupAfter
    ? normalizeTimestamp(value.cleanupAfter, "DatasetInstance.lifecycleMetadata.cleanupAfter")
    : undefined;
  const cleanupStatus = value.cleanupStatus
    ? normalizeCleanupStatus(value.cleanupStatus)
    : undefined;

  if (retentionPolicy === DatasetInstanceRetentionPolicies.manual && maxAgeDays !== undefined) {
    throw new Error("Dataset instance lifecycle metadata cannot set maxAgeDays when retentionPolicy is manual.");
  }
  if (retentionPolicy === DatasetInstanceRetentionPolicies.ttl && maxAgeDays === undefined) {
    throw new Error("Dataset instance lifecycle metadata must set maxAgeDays when retentionPolicy is ttl.");
  }

  if (
    retentionPolicy === undefined
    && maxAgeDays === undefined
    && cleanupAfter === undefined
    && cleanupStatus === undefined
  ) {
    return undefined;
  }

  return Object.freeze({
    retentionPolicy,
    maxAgeDays,
    cleanupAfter,
    cleanupStatus,
  });
}

function normalizeRetentionPolicy(value: DatasetInstanceRetentionPolicy): DatasetInstanceRetentionPolicy {
  if (Object.values(DatasetInstanceRetentionPolicies).includes(value)) {
    return value;
  }
  throw new Error(`Dataset instance retention policy '${value}' is not supported.`);
}

function normalizeCleanupStatus(value: DatasetInstanceCleanupStatus): DatasetInstanceCleanupStatus {
  if (Object.values(DatasetInstanceCleanupStatuses).includes(value)) {
    return value;
  }
  throw new Error(`Dataset instance cleanup status '${value}' is not supported.`);
}

function normalizeMaxAgeDays(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Dataset instance lifecycle metadata maxAgeDays must be a positive integer.");
  }
  return value;
}

export function createDatasetInstance(input: {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: DatasetInstanceRole;
  readonly purpose?: string;
  readonly lifecycleStatus?: DatasetInstanceLifecycleStatus;
  readonly runtimeStatus?: DatasetInstanceRuntimeStatus;
  readonly storageBinding?: DatasetInstanceStorageBinding;
  readonly seedMetadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly lifecycleMetadata?: DatasetInstanceLifecycleMetadata;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}): DatasetInstance {
  const createdAt = normalizeTimestamp(input.createdAt, "DatasetInstance.createdAt");
  const updatedAt = normalizeTimestamp(input.updatedAt, "DatasetInstance.updatedAt");
  if (updatedAt < createdAt) {
    throw new Error("DatasetInstance.updatedAt cannot be earlier than createdAt.");
  }

  return Object.freeze({
    instanceId: normalizeRequired(input.instanceId, "Dataset instance id"),
    systemId: normalizeRequired(input.systemId, "Dataset instance system id"),
    datasetAssetId: normalizeRequired(input.datasetAssetId, "Dataset instance dataset asset id"),
    datasetAssetVersionId: normalizeOptional(input.datasetAssetVersionId),
    role: normalizeRole(input.role),
    purpose: normalizeOptional(input.purpose),
    lifecycleStatus: normalizeLifecycleStatus(input.lifecycleStatus ?? DatasetInstanceLifecycleStatuses.provisioning),
    runtimeStatus: normalizeRuntimeStatus(input.runtimeStatus ?? DatasetInstanceRuntimeStatuses.idle),
    storageBinding: normalizeStorageBinding(input.storageBinding),
    seedMetadata: normalizeSeedMetadata(input.seedMetadata),
    lifecycleMetadata: normalizeLifecycleMetadata(input.lifecycleMetadata),
    createdAt,
    updatedAt,
  });
}

const AllowedLifecycleTransitions = Object.freeze({
  [DatasetInstanceLifecycleStatuses.provisioning]: Object.freeze([
    DatasetInstanceLifecycleStatuses.ready,
    DatasetInstanceLifecycleStatuses.failed,
    DatasetInstanceLifecycleStatuses.archived,
  ]),
  [DatasetInstanceLifecycleStatuses.ready]: Object.freeze([
    DatasetInstanceLifecycleStatuses.failed,
    DatasetInstanceLifecycleStatuses.archived,
  ]),
  [DatasetInstanceLifecycleStatuses.failed]: Object.freeze([
    DatasetInstanceLifecycleStatuses.provisioning,
    DatasetInstanceLifecycleStatuses.ready,
    DatasetInstanceLifecycleStatuses.archived,
  ]),
  [DatasetInstanceLifecycleStatuses.archived]: Object.freeze([]),
} as const);

export function isDatasetInstanceLifecycleTransitionAllowed(input: {
  readonly current: DatasetInstanceLifecycleStatus;
  readonly next: DatasetInstanceLifecycleStatus;
}): boolean {
  if (input.current === input.next) {
    return true;
  }
  const allowed = AllowedLifecycleTransitions[input.current];
  return allowed.includes(input.next);
}

export function transitionDatasetInstanceLifecycle(input: {
  readonly instance: DatasetInstance;
  readonly nextLifecycleStatus: DatasetInstanceLifecycleStatus;
  readonly nextRuntimeStatus?: DatasetInstanceRuntimeStatus;
  readonly updatedAt?: string;
}): DatasetInstance {
  if (!isDatasetInstanceLifecycleTransitionAllowed({
    current: input.instance.lifecycleStatus,
    next: input.nextLifecycleStatus,
  })) {
    throw new Error(
      `Dataset instance '${input.instance.instanceId}' cannot transition lifecycle from '${input.instance.lifecycleStatus}' to '${input.nextLifecycleStatus}'.`,
    );
  }

  const updatedAt = normalizePatchTimestamp(input.updatedAt);
  if (updatedAt < input.instance.createdAt) {
    throw new Error("DatasetInstance.updatedAt cannot be earlier than createdAt.");
  }
  if (updatedAt < input.instance.updatedAt) {
    throw new Error("DatasetInstance.updatedAt cannot move backwards.");
  }

  return createDatasetInstance({
    ...input.instance,
    lifecycleStatus: input.nextLifecycleStatus,
    runtimeStatus: input.nextRuntimeStatus ?? input.instance.runtimeStatus,
    updatedAt,
  });
}

export function patchDatasetInstance(input: {
  readonly instance: DatasetInstance;
  readonly patch: DatasetInstancePatch;
}): DatasetInstance {
  const updatedAt = normalizePatchTimestamp(input.patch.updatedAt);
  if (updatedAt < input.instance.createdAt) {
    throw new Error("DatasetInstance.updatedAt cannot be earlier than createdAt.");
  }
  if (updatedAt < input.instance.updatedAt) {
    throw new Error("DatasetInstance.updatedAt cannot move backwards.");
  }

  const patch = input.patch;
  return createDatasetInstance({
    ...input.instance,
    datasetAssetVersionId: patch.datasetAssetVersionId === null
      ? undefined
      : patch.datasetAssetVersionId ?? input.instance.datasetAssetVersionId,
    purpose: patch.purpose === null
      ? undefined
      : patch.purpose ?? input.instance.purpose,
    lifecycleStatus: patch.lifecycleStatus ?? input.instance.lifecycleStatus,
    runtimeStatus: patch.runtimeStatus ?? input.instance.runtimeStatus,
    storageBinding: patch.storageBinding === null
      ? undefined
      : patch.storageBinding ?? input.instance.storageBinding,
    seedMetadata: patch.seedMetadata === null
      ? undefined
      : patch.seedMetadata ?? input.instance.seedMetadata,
    lifecycleMetadata: patch.lifecycleMetadata === null
      ? undefined
      : patch.lifecycleMetadata ?? input.instance.lifecycleMetadata,
    updatedAt,
  });
}
