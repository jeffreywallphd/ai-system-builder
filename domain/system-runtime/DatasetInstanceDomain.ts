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

export interface DatasetInstance {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: DatasetInstanceRole;
  readonly purpose?: string;
  readonly lifecycleStatus: DatasetInstanceLifecycleStatus;
  readonly runtimeStatus: DatasetInstanceRuntimeStatus;
  readonly seedMetadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly lifecycleMetadata?: DatasetInstanceLifecycleMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
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

function normalizeTimestamp(value: string | undefined, label: string): string {
  const normalized = normalizeOptional(value) ?? new Date().toISOString();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return normalized;
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
    seedMetadata: normalizeSeedMetadata(input.seedMetadata),
    lifecycleMetadata: normalizeLifecycleMetadata(input.lifecycleMetadata),
    createdAt,
    updatedAt,
  });
}
