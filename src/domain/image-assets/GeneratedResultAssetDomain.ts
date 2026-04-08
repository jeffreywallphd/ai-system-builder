import {
  AssetVisibilities,
  type AssetId,
  type AssetSharingPolicyReference,
  type AssetVisibility,
  createAssetId,
  createStorageInstanceRef,
} from "@domain/assets/AssetDomain";

export class GeneratedResultAssetDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratedResultAssetDomainError";
  }
}

export class GeneratedResultAssetLifecycleTransitionError extends GeneratedResultAssetDomainError {
  constructor(fromStatus: GeneratedResultAssetStatus, toStatus: GeneratedResultAssetStatus) {
    super(`Generated result asset lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "GeneratedResultAssetLifecycleTransitionError";
  }
}

export const GeneratedResultAssetStatuses = Object.freeze({
  pendingCollection: "pending-collection",
  available: "available",
  previewReady: "preview-ready",
  failedCollection: "failed-collection",
  archived: "archived",
} as const);

export type GeneratedResultAssetStatus =
  typeof GeneratedResultAssetStatuses[keyof typeof GeneratedResultAssetStatuses];

export const GeneratedResultAssetLifecycleTransitions: Readonly<
  Record<GeneratedResultAssetStatus, ReadonlyArray<GeneratedResultAssetStatus>>
> = Object.freeze({
  [GeneratedResultAssetStatuses.pendingCollection]: Object.freeze([
    GeneratedResultAssetStatuses.available,
    GeneratedResultAssetStatuses.failedCollection,
  ]),
  [GeneratedResultAssetStatuses.available]: Object.freeze([
    GeneratedResultAssetStatuses.previewReady,
    GeneratedResultAssetStatuses.archived,
  ]),
  [GeneratedResultAssetStatuses.previewReady]: Object.freeze([
    GeneratedResultAssetStatuses.archived,
  ]),
  [GeneratedResultAssetStatuses.failedCollection]: Object.freeze([
    GeneratedResultAssetStatuses.pendingCollection,
  ]),
  [GeneratedResultAssetStatuses.archived]: Object.freeze([]),
});

export interface GeneratedResultAssetSource {
  readonly runId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly outputSlot: string;
}

export interface GeneratedResultAssetLineage {
  readonly inputAssetIds: ReadonlyArray<AssetId>;
  readonly workflowTemplateVersionId?: string;
  readonly workflowTemplateVersionTag?: string;
  readonly systemSnapshotId?: string;
  readonly systemVersionTag?: string;
  readonly parameterSnapshotId?: string;
  readonly selectedNodeId?: string;
  readonly executionAdapterKind?: string;
  readonly executionBackendFamily?: string;
}

export interface GeneratedResultAssetLifecycleMetadata {
  readonly status: GeneratedResultAssetStatus;
  readonly pendingSince: string;
  readonly logicalAssetVersionId?: string;
  readonly persistedAt?: string;
  readonly persistedBy?: string;
  readonly previewReadyAt?: string;
  readonly previewReadyBy?: string;
  readonly failedAt?: string;
  readonly failedBy?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly archivedAt?: string;
  readonly archivedBy?: string;
}

export interface GeneratedResultAsset {
  readonly resultAssetId: AssetId;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly source: GeneratedResultAssetSource;
  readonly lineage: GeneratedResultAssetLineage;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly lifecycle: GeneratedResultAssetLifecycleMetadata;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GeneratedResultAssetDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new GeneratedResultAssetDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeStatus(value: GeneratedResultAssetStatus): GeneratedResultAssetStatus {
  if (!Object.values(GeneratedResultAssetStatuses).includes(value)) {
    throw new GeneratedResultAssetDomainError(`Generated result asset status '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeAssetVisibility(value: AssetVisibility): AssetVisibility {
  if (!Object.values(AssetVisibilities).includes(value)) {
    throw new GeneratedResultAssetDomainError(`Generated result asset visibility '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeStorageBindingReference(
  value: string | undefined,
  storageInstanceId: string,
): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  if (/^[a-zA-Z]:\\/.test(normalized) || normalized.includes("\\") || normalized.startsWith("/")) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset storageBindingReference must be a logical storage reference, not a filesystem path.",
    );
  }

  const match = /^storage-instance:\/\/([a-z0-9][a-z0-9-]{2,126})(?:\/[a-z0-9._:-]+)?$/.exec(normalized);
  if (!match) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset storageBindingReference must use 'storage-instance://<id>' or 'storage-instance://<id>/<area>'.",
    );
  }

  if (match[1] !== storageInstanceId) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset storageBindingReference must match storageInstanceId.",
    );
  }

  return normalized;
}

function normalizeSource(input: GeneratedResultAssetSource): GeneratedResultAssetSource {
  const outputSlot = normalizeRequired(input.outputSlot, "Generated result asset source.outputSlot").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(outputSlot)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset source.outputSlot must be 1-128 characters and use lowercase alphanumeric, '.', '_', ':', or '-'.",
    );
  }

  return Object.freeze({
    runId: normalizeRequired(input.runId, "Generated result asset source.runId"),
    systemId: normalizeRequired(input.systemId, "Generated result asset source.systemId"),
    workflowId: normalizeRequired(input.workflowId, "Generated result asset source.workflowId"),
    workflowTemplateId: normalizeOptional(input.workflowTemplateId),
    executionNodeId: normalizeOptional(input.executionNodeId),
    outputSlot,
  });
}

function normalizeLineage(input: GeneratedResultAssetLineage): GeneratedResultAssetLineage {
  const normalized = [...new Set(
    input.inputAssetIds.map((entry) => createAssetId(entry).toString()),
  )];

  if (normalized.length < 1) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage must include at least one input asset id.",
    );
  }

  const workflowTemplateVersionId = normalizeOptional(input.workflowTemplateVersionId);
  const workflowTemplateVersionTag = normalizeOptional(input.workflowTemplateVersionTag);
  const systemSnapshotId = normalizeOptional(input.systemSnapshotId);
  const systemVersionTag = normalizeOptional(input.systemVersionTag);
  const parameterSnapshotId = normalizeOptional(input.parameterSnapshotId);
  const selectedNodeId = normalizeOptional(input.selectedNodeId);
  const executionAdapterKind = normalizeOptional(input.executionAdapterKind)?.toLowerCase();
  const executionBackendFamily = normalizeOptional(input.executionBackendFamily)?.toLowerCase();

  if (workflowTemplateVersionTag && !/^\d+\.\d+\.\d+$/.test(workflowTemplateVersionTag)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.workflowTemplateVersionTag must use semantic version format '<major>.<minor>.<patch>'.",
    );
  }

  if (systemVersionTag && !/^\d+\.\d+\.\d+$/.test(systemVersionTag)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.systemVersionTag must use semantic version format '<major>.<minor>.<patch>'.",
    );
  }

  if (selectedNodeId && !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,191}$/.test(selectedNodeId)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.selectedNodeId must be 3-192 characters and use letters, numbers, '.', '_', ':', or '-'.",
    );
  }

  if (executionAdapterKind && !/^[a-z0-9][a-z0-9._:-]{1,126}$/.test(executionAdapterKind)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.executionAdapterKind must be 2-127 lowercase characters and use alphanumeric, '.', '_', ':', or '-'.",
    );
  }

  if (executionBackendFamily && !/^[a-z0-9][a-z0-9._:-]{1,126}$/.test(executionBackendFamily)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.executionBackendFamily must be 2-127 lowercase characters and use alphanumeric, '.', '_', ':', or '-'.",
    );
  }

  if (workflowTemplateVersionId && !workflowTemplateVersionTag) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.workflowTemplateVersionTag is required when workflowTemplateVersionId is provided.",
    );
  }

  if (!workflowTemplateVersionId && workflowTemplateVersionTag) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.workflowTemplateVersionId is required when workflowTemplateVersionTag is provided.",
    );
  }

  return Object.freeze({
    inputAssetIds: Object.freeze(normalized),
    workflowTemplateVersionId,
    workflowTemplateVersionTag,
    systemSnapshotId,
    systemVersionTag,
    parameterSnapshotId,
    selectedNodeId,
    executionAdapterKind,
    executionBackendFamily,
  });
}

function normalizeSharingPolicyRef(
  value: AssetSharingPolicyReference | undefined,
): AssetSharingPolicyReference | undefined {
  if (!value) {
    return undefined;
  }

  return Object.freeze({
    policyId: normalizeRequired(value.policyId, "Generated result asset sharingPolicyRef.policyId"),
    policyVersion: normalizeOptional(value.policyVersion),
  });
}

function normalizeLifecycle(
  input: GeneratedResultAssetLifecycleMetadata,
): GeneratedResultAssetLifecycleMetadata {
  return Object.freeze({
    status: normalizeStatus(input.status),
    pendingSince: normalizeTimestamp(input.pendingSince, "Generated result asset lifecycle.pendingSince"),
    logicalAssetVersionId: normalizeOptional(input.logicalAssetVersionId),
    persistedAt: input.persistedAt
      ? normalizeTimestamp(input.persistedAt, "Generated result asset lifecycle.persistedAt")
      : undefined,
    persistedBy: normalizeOptional(input.persistedBy),
    previewReadyAt: input.previewReadyAt
      ? normalizeTimestamp(input.previewReadyAt, "Generated result asset lifecycle.previewReadyAt")
      : undefined,
    previewReadyBy: normalizeOptional(input.previewReadyBy),
    failedAt: input.failedAt
      ? normalizeTimestamp(input.failedAt, "Generated result asset lifecycle.failedAt")
      : undefined,
    failedBy: normalizeOptional(input.failedBy),
    failureCode: normalizeOptional(input.failureCode),
    failureMessage: normalizeOptional(input.failureMessage),
    archivedAt: input.archivedAt
      ? normalizeTimestamp(input.archivedAt, "Generated result asset lifecycle.archivedAt")
      : undefined,
    archivedBy: normalizeOptional(input.archivedBy),
  });
}

function assertVisibilityOwnershipInvariants(asset: {
  readonly ownerUserId?: string;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
}): void {
  if (!asset.ownerUserId && asset.visibility === AssetVisibilities.private) {
    throw new GeneratedResultAssetDomainError(
      "Private generated result assets require ownerUserId.",
    );
  }

  if (
    (asset.visibility === AssetVisibilities.private || asset.visibility === AssetVisibilities.workspace)
    && asset.sharingPolicyRef
  ) {
    throw new GeneratedResultAssetDomainError(
      `Generated result asset visibility '${asset.visibility}' cannot include sharingPolicyRef.`,
    );
  }

  if (
    (asset.visibility === AssetVisibilities.shared || asset.visibility === AssetVisibilities.published)
    && !asset.sharingPolicyRef
  ) {
    throw new GeneratedResultAssetDomainError(
      `Generated result asset visibility '${asset.visibility}' requires sharingPolicyRef.`,
    );
  }
}

function assertLifecycleInvariants(lifecycle: GeneratedResultAssetLifecycleMetadata): void {
  if ((lifecycle.persistedAt && !lifecycle.persistedBy) || (!lifecycle.persistedAt && lifecycle.persistedBy)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lifecycle persistedAt and persistedBy must be provided together.",
    );
  }

  if ((lifecycle.previewReadyAt && !lifecycle.previewReadyBy) || (!lifecycle.previewReadyAt && lifecycle.previewReadyBy)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lifecycle previewReadyAt and previewReadyBy must be provided together.",
    );
  }

  if ((lifecycle.failedAt && !lifecycle.failedBy) || (!lifecycle.failedAt && lifecycle.failedBy)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lifecycle failedAt and failedBy must be provided together.",
    );
  }

  if ((lifecycle.archivedAt && !lifecycle.archivedBy) || (!lifecycle.archivedAt && lifecycle.archivedBy)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lifecycle archivedAt and archivedBy must be provided together.",
    );
  }

  if (lifecycle.status === GeneratedResultAssetStatuses.pendingCollection) {
    if (
      lifecycle.logicalAssetVersionId
      || lifecycle.persistedAt
      || lifecycle.persistedBy
      || lifecycle.previewReadyAt
      || lifecycle.previewReadyBy
      || lifecycle.failedAt
      || lifecycle.failedBy
      || lifecycle.failureCode
      || lifecycle.failureMessage
      || lifecycle.archivedAt
      || lifecycle.archivedBy
    ) {
      throw new GeneratedResultAssetDomainError(
        "Pending generated result assets cannot include persisted, preview, failed, or archived metadata.",
      );
    }
    return;
  }

  if (lifecycle.status === GeneratedResultAssetStatuses.available) {
    if (!lifecycle.logicalAssetVersionId || !lifecycle.persistedAt || !lifecycle.persistedBy) {
      throw new GeneratedResultAssetDomainError(
        "Available generated result assets must include logicalAssetVersionId, persistedAt, and persistedBy.",
      );
    }
    if (
      lifecycle.previewReadyAt
      || lifecycle.previewReadyBy
      || lifecycle.failedAt
      || lifecycle.failedBy
      || lifecycle.failureCode
      || lifecycle.failureMessage
      || lifecycle.archivedAt
      || lifecycle.archivedBy
    ) {
      throw new GeneratedResultAssetDomainError(
        "Available generated result assets cannot include preview, failed, or archived metadata.",
      );
    }
    return;
  }

  if (lifecycle.status === GeneratedResultAssetStatuses.previewReady) {
    if (
      !lifecycle.logicalAssetVersionId
      || !lifecycle.persistedAt
      || !lifecycle.persistedBy
      || !lifecycle.previewReadyAt
      || !lifecycle.previewReadyBy
    ) {
      throw new GeneratedResultAssetDomainError(
        "Preview-ready generated result assets must include persistence metadata and preview readiness metadata.",
      );
    }
    if (
      lifecycle.failedAt
      || lifecycle.failedBy
      || lifecycle.failureCode
      || lifecycle.failureMessage
      || lifecycle.archivedAt
      || lifecycle.archivedBy
    ) {
      throw new GeneratedResultAssetDomainError(
        "Preview-ready generated result assets cannot include failed or archived metadata.",
      );
    }

    if (Date.parse(lifecycle.previewReadyAt) < Date.parse(lifecycle.persistedAt)) {
      throw new GeneratedResultAssetDomainError(
        "Generated result asset previewReadyAt cannot be earlier than persistedAt.",
      );
    }
    return;
  }

  if (lifecycle.status === GeneratedResultAssetStatuses.failedCollection) {
    if (!lifecycle.failedAt || !lifecycle.failedBy || !lifecycle.failureCode || !lifecycle.failureMessage) {
      throw new GeneratedResultAssetDomainError(
        "Failed-collection generated result assets must include failedAt, failedBy, failureCode, and failureMessage.",
      );
    }
    if (
      lifecycle.logicalAssetVersionId
      || lifecycle.persistedAt
      || lifecycle.persistedBy
      || lifecycle.previewReadyAt
      || lifecycle.previewReadyBy
      || lifecycle.archivedAt
      || lifecycle.archivedBy
    ) {
      throw new GeneratedResultAssetDomainError(
        "Failed-collection generated result assets cannot include persisted, preview, or archived metadata.",
      );
    }
    return;
  }

  if (!lifecycle.logicalAssetVersionId || !lifecycle.persistedAt || !lifecycle.persistedBy) {
    throw new GeneratedResultAssetDomainError(
      "Archived generated result assets must include logicalAssetVersionId, persistedAt, and persistedBy.",
    );
  }
  if (!lifecycle.archivedAt || !lifecycle.archivedBy) {
    throw new GeneratedResultAssetDomainError(
      "Archived generated result assets must include archivedAt and archivedBy.",
    );
  }
  if (lifecycle.failedAt || lifecycle.failedBy || lifecycle.failureCode || lifecycle.failureMessage) {
    throw new GeneratedResultAssetDomainError(
      "Archived generated result assets cannot include failed metadata.",
    );
  }

  if (lifecycle.previewReadyAt && Date.parse(lifecycle.archivedAt) < Date.parse(lifecycle.previewReadyAt)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset archivedAt cannot be earlier than previewReadyAt.",
    );
  }

  if (Date.parse(lifecycle.archivedAt) < Date.parse(lifecycle.persistedAt)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset archivedAt cannot be earlier than persistedAt.",
    );
  }
}

function assertUpdatedAtInvariant(createdAt: string, updatedAt: string): void {
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset updatedAt cannot be earlier than createdAt.",
    );
  }
}

function assertInputLineageInvariants(asset: {
  readonly resultAssetId: AssetId;
  readonly source: GeneratedResultAssetSource;
  readonly lineage: GeneratedResultAssetLineage;
}): void {
  if (asset.lineage.inputAssetIds.includes(asset.resultAssetId)) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.inputAssetIds cannot include resultAssetId itself.",
    );
  }

  if (asset.lineage.workflowTemplateVersionId && !asset.source.workflowTemplateId) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.workflowTemplateVersionId requires source.workflowTemplateId.",
    );
  }

  if (
    asset.lineage.selectedNodeId
    && asset.source.executionNodeId
    && asset.lineage.selectedNodeId !== asset.source.executionNodeId
  ) {
    throw new GeneratedResultAssetDomainError(
      "Generated result asset lineage.selectedNodeId must match source.executionNodeId when both are provided.",
    );
  }
}

function assertGeneratedResultAssetInvariants(asset: GeneratedResultAsset): void {
  assertVisibilityOwnershipInvariants(asset);
  assertLifecycleInvariants(asset.lifecycle);
  assertUpdatedAtInvariant(asset.createdAt, asset.updatedAt);
  assertInputLineageInvariants(asset);
}

function isTransitionAllowed(from: GeneratedResultAssetStatus, to: GeneratedResultAssetStatus): boolean {
  if (from === to) {
    return true;
  }

  return GeneratedResultAssetLifecycleTransitions[from].includes(to);
}

export function rehydrateGeneratedResultAsset(input: {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly source: GeneratedResultAssetSource;
  readonly lineage: GeneratedResultAssetLineage;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly lifecycle: GeneratedResultAssetLifecycleMetadata;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}): GeneratedResultAsset {
  const storageInstanceRef = createStorageInstanceRef({ storageInstanceId: input.storageInstanceId });

  const asset = Object.freeze({
    resultAssetId: createAssetId(input.resultAssetId),
    workspaceId: normalizeRequired(input.workspaceId, "Generated result asset workspaceId"),
    ownerUserId: normalizeOptional(input.ownerUserId),
    source: normalizeSource(input.source),
    lineage: normalizeLineage(input.lineage),
    storageInstanceId: storageInstanceRef.storageInstanceId,
    storageBindingReference: normalizeStorageBindingReference(
      input.storageBindingReference,
      storageInstanceRef.storageInstanceId,
    ),
    visibility: normalizeAssetVisibility(input.visibility),
    sharingPolicyRef: normalizeSharingPolicyRef(input.sharingPolicyRef),
    lifecycle: normalizeLifecycle(input.lifecycle),
    createdBy: normalizeRequired(input.createdBy, "Generated result asset createdBy"),
    lastModifiedBy: normalizeRequired(input.lastModifiedBy, "Generated result asset lastModifiedBy"),
    createdAt: normalizeTimestamp(input.createdAt, "Generated result asset createdAt"),
    updatedAt: normalizeTimestamp(input.updatedAt, "Generated result asset updatedAt"),
  });

  assertGeneratedResultAssetInvariants(asset);
  return asset;
}

export function createGeneratedResultAsset(input: {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly source: GeneratedResultAssetSource;
  readonly lineage: GeneratedResultAssetLineage;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly visibility?: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly createdBy: string;
  readonly createdAt?: Date | string;
  readonly lastModifiedBy?: string;
  readonly updatedAt?: Date | string;
}): GeneratedResultAsset {
  const createdAt = normalizeTimestamp(input.createdAt ?? new Date(), "Generated result asset createdAt");
  const updatedAt = normalizeTimestamp(input.updatedAt ?? createdAt, "Generated result asset updatedAt");

  return rehydrateGeneratedResultAsset({
    resultAssetId: input.resultAssetId,
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    source: input.source,
    lineage: input.lineage,
    storageInstanceId: input.storageInstanceId,
    storageBindingReference: input.storageBindingReference,
    visibility: input.visibility ?? AssetVisibilities.workspace,
    sharingPolicyRef: input.sharingPolicyRef,
    lifecycle: {
      status: GeneratedResultAssetStatuses.pendingCollection,
      pendingSince: createdAt,
    },
    createdBy: input.createdBy,
    lastModifiedBy: input.lastModifiedBy ?? input.createdBy,
    createdAt,
    updatedAt,
  });
}

export function transitionGeneratedResultAssetStatus(
  asset: GeneratedResultAsset,
  input: {
    readonly nextStatus: GeneratedResultAssetStatus;
    readonly actorUserId: string;
    readonly occurredAt?: Date | string;
    readonly logicalAssetVersionId?: string;
    readonly failureCode?: string;
    readonly failureMessage?: string;
  },
): GeneratedResultAsset {
  const nextStatus = normalizeStatus(input.nextStatus);
  if (!isTransitionAllowed(asset.lifecycle.status, nextStatus)) {
    throw new GeneratedResultAssetLifecycleTransitionError(asset.lifecycle.status, nextStatus);
  }

  if (nextStatus === asset.lifecycle.status) {
    return asset;
  }

  const occurredAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Generated result asset transition occurredAt");
  const actorUserId = normalizeRequired(input.actorUserId, "Generated result asset transition actorUserId");

  const nextLifecycle: GeneratedResultAssetLifecycleMetadata = nextStatus === GeneratedResultAssetStatuses.pendingCollection
    ? {
      status: GeneratedResultAssetStatuses.pendingCollection,
      pendingSince: asset.lifecycle.pendingSince,
    }
    : nextStatus === GeneratedResultAssetStatuses.available
      ? {
        status: GeneratedResultAssetStatuses.available,
        pendingSince: asset.lifecycle.pendingSince,
        logicalAssetVersionId: normalizeRequired(
          input.logicalAssetVersionId ?? asset.lifecycle.logicalAssetVersionId,
          "Generated result asset transition logicalAssetVersionId",
        ),
        persistedAt: occurredAt,
        persistedBy: actorUserId,
      }
      : nextStatus === GeneratedResultAssetStatuses.previewReady
        ? {
          status: GeneratedResultAssetStatuses.previewReady,
          pendingSince: asset.lifecycle.pendingSince,
          logicalAssetVersionId: normalizeRequired(
            asset.lifecycle.logicalAssetVersionId,
            "Generated result asset lifecycle.logicalAssetVersionId",
          ),
          persistedAt: normalizeRequired(
            asset.lifecycle.persistedAt,
            "Generated result asset lifecycle.persistedAt",
          ),
          persistedBy: normalizeRequired(
            asset.lifecycle.persistedBy,
            "Generated result asset lifecycle.persistedBy",
          ),
          previewReadyAt: occurredAt,
          previewReadyBy: actorUserId,
        }
        : nextStatus === GeneratedResultAssetStatuses.failedCollection
          ? {
            status: GeneratedResultAssetStatuses.failedCollection,
            pendingSince: asset.lifecycle.pendingSince,
            failedAt: occurredAt,
            failedBy: actorUserId,
            failureCode: normalizeRequired(
              input.failureCode ?? "collection-failed",
              "Generated result asset transition failureCode",
            ),
            failureMessage: normalizeRequired(
              input.failureMessage ?? "Generated result collection failed.",
              "Generated result asset transition failureMessage",
            ),
          }
          : {
            status: GeneratedResultAssetStatuses.archived,
            pendingSince: asset.lifecycle.pendingSince,
            logicalAssetVersionId: normalizeRequired(
              asset.lifecycle.logicalAssetVersionId,
              "Generated result asset lifecycle.logicalAssetVersionId",
            ),
            persistedAt: normalizeRequired(
              asset.lifecycle.persistedAt,
              "Generated result asset lifecycle.persistedAt",
            ),
            persistedBy: normalizeRequired(
              asset.lifecycle.persistedBy,
              "Generated result asset lifecycle.persistedBy",
            ),
            previewReadyAt: asset.lifecycle.previewReadyAt,
            previewReadyBy: asset.lifecycle.previewReadyBy,
            archivedAt: occurredAt,
            archivedBy: actorUserId,
          };

  return rehydrateGeneratedResultAsset({
    ...asset,
    lifecycle: nextLifecycle,
    lastModifiedBy: actorUserId,
    updatedAt: occurredAt,
  });
}

export function updateGeneratedResultAssetVisibility(
  asset: GeneratedResultAsset,
  input: {
    readonly visibility: AssetVisibility;
    readonly sharingPolicyRef?: AssetSharingPolicyReference;
    readonly actorUserId: string;
    readonly occurredAt?: Date | string;
  },
): GeneratedResultAsset {
  if (asset.lifecycle.status === GeneratedResultAssetStatuses.archived) {
    throw new GeneratedResultAssetDomainError("Archived generated result assets cannot update visibility.");
  }

  const occurredAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Generated result asset visibility occurredAt");
  const actorUserId = normalizeRequired(input.actorUserId, "Generated result asset visibility actorUserId");

  return rehydrateGeneratedResultAsset({
    ...asset,
    visibility: input.visibility,
    sharingPolicyRef: input.sharingPolicyRef,
    lastModifiedBy: actorUserId,
    updatedAt: occurredAt,
  });
}
