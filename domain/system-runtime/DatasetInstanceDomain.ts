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
  readonly bindingArea: "input" | "output" | "reference" | "intermediate";
  readonly bindingId: string;
  readonly bindingReference: string;
}

export const DatasetInstanceAccessBindingKinds = Object.freeze({
  system: "system",
  embeddedSubsystem: "embedded-subsystem",
} as const);

export type DatasetInstanceAccessBindingKind =
  typeof DatasetInstanceAccessBindingKinds[keyof typeof DatasetInstanceAccessBindingKinds];

export interface DatasetInstanceAccessBinding {
  readonly bindingId: string;
  readonly accessorId: string;
  readonly accessorKind: DatasetInstanceAccessBindingKind;
  readonly role?: string;
  readonly attachedAt: string;
}

export const DatasetInstanceStorageContractVersion = "2.0.0";

export interface DatasetInstance {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: DatasetInstanceRole;
  readonly purpose?: string;
  readonly storageContractVersion?: string;
  readonly storageBindings?: ReadonlyArray<DatasetInstanceStorageBinding>;
  // Backward-compatible projection for single-binding call paths.
  readonly lifecycleStatus: DatasetInstanceLifecycleStatus;
  readonly runtimeStatus: DatasetInstanceRuntimeStatus;
  readonly storageBinding?: DatasetInstanceStorageBinding;
  readonly accessBindings?: ReadonlyArray<DatasetInstanceAccessBinding>;
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
  readonly storageContractVersion?: string | null;
  readonly storageBindings?: ReadonlyArray<DatasetInstanceStorageBinding> | null;
  readonly storageBinding?: DatasetInstanceStorageBinding | null;
  readonly accessBindings?: ReadonlyArray<DatasetInstanceAccessBinding> | null;
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
  if (bindingArea !== "input" && bindingArea !== "output" && bindingArea !== "reference" && bindingArea !== "intermediate") {
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

function normalizeStorageBindings(
  value?: ReadonlyArray<DatasetInstanceStorageBinding>,
): ReadonlyArray<DatasetInstanceStorageBinding> | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }
  const normalized = value
    .map((entry) => normalizeStorageBinding(entry))
    .filter((entry): entry is DatasetInstanceStorageBinding => Boolean(entry));
  if (normalized.length === 0) {
    return undefined;
  }
  const seen = new Set<string>();
  for (const binding of normalized) {
    const key = `${binding.bindingId}::${binding.bindingArea}`;
    if (seen.has(key)) {
      throw new Error(`Dataset instance storage bindings contain duplicate logical binding '${key}'.`);
    }
    seen.add(key);
  }
  return Object.freeze(normalized);
}

function normalizeStorageContractVersion(value?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Dataset instance storageContractVersion must be a non-empty string when provided.");
  }
  return normalized;
}

function normalizeAccessBindingKind(value: DatasetInstanceAccessBindingKind): DatasetInstanceAccessBindingKind {
  if (Object.values(DatasetInstanceAccessBindingKinds).includes(value)) {
    return value;
  }
  throw new Error(`Dataset instance access binding kind '${value}' is not supported.`);
}

function normalizeAccessBinding(input: DatasetInstanceAccessBinding): DatasetInstanceAccessBinding {
  const bindingId = normalizeRequired(input.bindingId, "Dataset instance access binding bindingId");
  const accessorId = normalizeRequired(input.accessorId, "Dataset instance access binding accessorId");
  const attachedAt = normalizeTimestamp(input.attachedAt, "Dataset instance access binding attachedAt");
  return Object.freeze({
    bindingId,
    accessorId,
    accessorKind: normalizeAccessBindingKind(input.accessorKind),
    role: normalizeOptional(input.role),
    attachedAt,
  });
}

function createOwnerAccessBinding(input: {
  readonly instanceId: string;
  readonly systemId: string;
  readonly createdAt: string;
}): DatasetInstanceAccessBinding {
  const systemId = normalizeRequired(input.systemId, "Dataset instance system id");
  return Object.freeze({
    bindingId: `dataset-instance-binding:${input.instanceId}:owner`,
    accessorId: systemId,
    accessorKind: DatasetInstanceAccessBindingKinds.system,
    role: "owner",
    attachedAt: input.createdAt,
  });
}

function normalizeAccessBindings(input: {
  readonly instanceId: string;
  readonly systemId: string;
  readonly createdAt: string;
  readonly accessBindings?: ReadonlyArray<DatasetInstanceAccessBinding>;
}): ReadonlyArray<DatasetInstanceAccessBinding> {
  const normalized = (input.accessBindings ?? [])
    .map((binding) => normalizeAccessBinding(binding));
  const ownerBinding = createOwnerAccessBinding({
    instanceId: input.instanceId,
    systemId: input.systemId,
    createdAt: input.createdAt,
  });
  const bindings = [ownerBinding, ...normalized];
  const byBindingId = new Map<string, DatasetInstanceAccessBinding>();
  for (const binding of bindings) {
    if (byBindingId.has(binding.bindingId)) {
      continue;
    }
    byBindingId.set(binding.bindingId, binding);
  }
  return Object.freeze([...byBindingId.values()]);
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
  readonly storageContractVersion?: string;
  readonly storageBindings?: ReadonlyArray<DatasetInstanceStorageBinding>;
  readonly lifecycleStatus?: DatasetInstanceLifecycleStatus;
  readonly runtimeStatus?: DatasetInstanceRuntimeStatus;
  readonly storageBinding?: DatasetInstanceStorageBinding;
  readonly accessBindings?: ReadonlyArray<DatasetInstanceAccessBinding>;
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

  const normalizedStorageBindings = normalizeStorageBindings(
    input.storageBindings ?? (input.storageBinding ? [input.storageBinding] : undefined),
  );
  const normalizedStorageContractVersion = normalizedStorageBindings
    ? normalizeStorageContractVersion(input.storageContractVersion) ?? DatasetInstanceStorageContractVersion
    : undefined;

  const instanceId = normalizeRequired(input.instanceId, "Dataset instance id");
  const systemId = normalizeRequired(input.systemId, "Dataset instance system id");
  return Object.freeze({
    instanceId,
    systemId,
    datasetAssetId: normalizeRequired(input.datasetAssetId, "Dataset instance dataset asset id"),
    datasetAssetVersionId: normalizeOptional(input.datasetAssetVersionId),
    role: normalizeRole(input.role),
    purpose: normalizeOptional(input.purpose),
    storageContractVersion: normalizedStorageContractVersion,
    storageBindings: normalizedStorageBindings,
    lifecycleStatus: normalizeLifecycleStatus(input.lifecycleStatus ?? DatasetInstanceLifecycleStatuses.provisioning),
    runtimeStatus: normalizeRuntimeStatus(input.runtimeStatus ?? DatasetInstanceRuntimeStatuses.idle),
    storageBinding: normalizedStorageBindings?.[0],
    accessBindings: normalizeAccessBindings({
      instanceId,
      systemId,
      createdAt,
      accessBindings: input.accessBindings,
    }),
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
  const patchedStorageBindings = patch.storageBindings === null
    ? undefined
    : patch.storageBindings
      ?? (patch.storageBinding === null
        ? undefined
        : patch.storageBinding
          ? [patch.storageBinding]
          : input.instance.storageBindings);
  const patchedStorageContractVersion = patch.storageContractVersion === null
    ? undefined
    : patch.storageContractVersion ?? input.instance.storageContractVersion;
  const patchedAccessBindings = patch.accessBindings === null
    ? undefined
    : patch.accessBindings ?? input.instance.accessBindings;

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
    storageContractVersion: patchedStorageContractVersion,
    storageBindings: patchedStorageBindings,
    accessBindings: patchedAccessBindings,
    seedMetadata: patch.seedMetadata === null
      ? undefined
      : patch.seedMetadata ?? input.instance.seedMetadata,
    lifecycleMetadata: patch.lifecycleMetadata === null
      ? undefined
      : patch.lifecycleMetadata ?? input.instance.lifecycleMetadata,
    updatedAt,
  });
}

export function hasDatasetInstanceAccessBinding(input: {
  readonly instance: DatasetInstance;
  readonly accessorId: string;
}): boolean {
  const accessorId = normalizeRequired(input.accessorId, "Dataset instance accessorId");
  return (input.instance.accessBindings ?? []).some((binding) => binding.accessorId === accessorId);
}

export function attachDatasetInstanceAccessBinding(input: {
  readonly instance: DatasetInstance;
  readonly accessorId: string;
  readonly accessorKind: DatasetInstanceAccessBindingKind;
  readonly role?: string;
  readonly bindingId?: string;
  readonly attachedAt?: string;
}): DatasetInstance {
  const accessorId = normalizeRequired(input.accessorId, "Dataset instance accessorId");
  if (hasDatasetInstanceAccessBinding({
    instance: input.instance,
    accessorId,
  })) {
    return input.instance;
  }
  const attachedAt = normalizeTimestamp(
    input.attachedAt,
    "Dataset instance access binding attachedAt",
  );
  const accessBindings = [
    ...(input.instance.accessBindings ?? []),
    Object.freeze({
      bindingId: normalizeOptional(input.bindingId)
        ?? `dataset-instance-binding:${input.instance.instanceId}:${encodeURIComponent(accessorId)}`,
      accessorId,
      accessorKind: normalizeAccessBindingKind(input.accessorKind),
      role: normalizeOptional(input.role),
      attachedAt,
    } satisfies DatasetInstanceAccessBinding),
  ];
  return patchDatasetInstance({
    instance: input.instance,
    patch: {
      accessBindings,
      updatedAt: attachedAt,
    },
  });
}

export function findDatasetInstanceStorageBinding(input: {
  readonly instance: DatasetInstance;
  readonly area: DatasetInstanceStorageBinding["bindingArea"];
}): DatasetInstanceStorageBinding | undefined {
  return input.instance.storageBindings?.find((binding) => binding.bindingArea === input.area);
}

export function resolveDatasetInstanceStorageBinding(input: {
  readonly instance: DatasetInstance;
  readonly preferredArea?: DatasetInstanceStorageBinding["bindingArea"];
}): DatasetInstanceStorageBinding | undefined {
  if (input.preferredArea) {
    const matched = findDatasetInstanceStorageBinding({
      instance: input.instance,
      area: input.preferredArea,
    });
    if (matched) {
      return matched;
    }
  }
  return input.instance.storageBindings?.[0] ?? input.instance.storageBinding;
}
