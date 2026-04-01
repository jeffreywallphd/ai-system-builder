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
    role: input.role,
    purpose: normalizeOptional(input.purpose),
    lifecycleStatus: input.lifecycleStatus ?? DatasetInstanceLifecycleStatuses.provisioning,
    runtimeStatus: input.runtimeStatus ?? DatasetInstanceRuntimeStatuses.idle,
    seedMetadata: normalizeSeedMetadata(input.seedMetadata),
    createdAt,
    updatedAt,
  });
}
