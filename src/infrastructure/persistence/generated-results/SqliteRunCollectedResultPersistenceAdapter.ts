import { createHash } from "node:crypto";
import type { IGeneratedResultPersistenceRepository } from "@application/generated-results/ports/IGeneratedResultPersistenceRepository";
import {
  ImageManipulationOutputPersistenceStatuses,
  type ImageManipulationCollectedOutputRecord,
  type ImageManipulationDiscoveredOutputDescriptor,
} from "@application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts";
import {
  RunCollectedResultPersistenceStatuses,
  type IRunCollectedResultPersistencePort,
  type RunCollectedResultPersistenceRequest,
  type RunCollectedResultPersistenceResult,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import { createWorkspaceTenancyMetadata } from "@shared/persistence/PersistenceTenancyMetadataFactory";
import type { GeneratedResultPersistenceRecord } from "@shared/dto/assets/GeneratedResultPersistenceDtos";

const KnownImageMediaTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/avif",
  "image/heic",
  "image/heif",
]);

interface SqliteRunCollectedResultPersistenceAdapterDependencies {
  readonly repository: IGeneratedResultPersistenceRepository;
  readonly now?: () => Date;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toDeterministicSuffix(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function toSafeResultAssetId(input: {
  readonly runId: string;
  readonly descriptorId: string;
  readonly discoveredOutput?: ImageManipulationDiscoveredOutputDescriptor;
  readonly persistedAssetId?: string;
}): string {
  const persistedAssetId = normalizeOptional(input.persistedAssetId);
  if (persistedAssetId) {
    return persistedAssetId;
  }

  const outputId = normalizeOptional(input.discoveredOutput?.slotMatch?.outputId)
    ?? normalizeOptional(input.descriptorId)
    ?? "unknown";

  return `gr-${toDeterministicSuffix(`${input.runId}:${outputId}`)}`;
}

function resolveSystemId(request: RunCollectedResultPersistenceRequest): string {
  const metadata = (request.collectedResult.metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    request.systemId,
    typeof metadata.systemId === "string" ? metadata.systemId : undefined,
    typeof metadata.runtimeSystemId === "string" ? metadata.runtimeSystemId : undefined,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOptional(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return `system-${toDeterministicSuffix(request.runId)}`;
}

function resolveStorageInstanceId(
  request: RunCollectedResultPersistenceRequest,
  record: ImageManipulationCollectedOutputRecord,
): string {
  const metadata = (record.metadata ?? {}) as Record<string, unknown>;
  const resultMetadata = (request.collectedResult.metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    typeof metadata.storageInstanceId === "string" ? metadata.storageInstanceId : undefined,
    typeof resultMetadata.storageInstanceId === "string" ? resultMetadata.storageInstanceId : undefined,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOptional(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const logicalReference = record.persistence.status === ImageManipulationOutputPersistenceStatuses.persisted
    ? normalizeOptional(record.persistence.logicalAsset.logicalAssetReference)
    : undefined;
  if (logicalReference?.startsWith("storage-instance://")) {
    const parsed = logicalReference.slice("storage-instance://".length).split("/")[0]?.trim();
    if (parsed) {
      return parsed;
    }
  }

  return "storage-default";
}

function resolveLineageInputAssetIds(
  request: RunCollectedResultPersistenceRequest,
  discovered: ImageManipulationDiscoveredOutputDescriptor | undefined,
  record: ImageManipulationCollectedOutputRecord,
): ReadonlyArray<string> {
  const collectedMetadata = (request.collectedResult.metadata ?? {}) as Record<string, unknown>;
  const lineageMetadata = (record.lineageMetadata ?? {}) as Record<string, unknown>;

  const values: string[] = [];

  const pushCandidate = (value: unknown): void => {
    if (typeof value !== "string") {
      return;
    }
    const normalized = normalizeOptional(value);
    if (normalized) {
      values.push(normalized);
    }
  };

  pushCandidate(discovered?.sourceInputAssetReference);

  const metadataArrays: unknown[] = [
    lineageMetadata.inputAssetIds,
    collectedMetadata.inputAssetIds,
  ];

  for (const candidate of metadataArrays) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    for (const entry of candidate) {
      pushCandidate(entry);
    }
  }

  return Object.freeze([...new Set(values)]);
}

function resolveMediaType(
  discovered: ImageManipulationDiscoveredOutputDescriptor | undefined,
): string | undefined {
  const mimeType = normalizeOptional(discovered?.media.mimeType)?.toLowerCase();
  return mimeType && KnownImageMediaTypes.has(mimeType) ? mimeType : undefined;
}

function resolveLifecycleStatus(
  record: ImageManipulationCollectedOutputRecord,
): GeneratedResultAssetStatuses[keyof typeof GeneratedResultAssetStatuses] {
  if (record.persistence.status === ImageManipulationOutputPersistenceStatuses.persisted) {
    return GeneratedResultAssetStatuses.available;
  }
  if (record.persistence.status === ImageManipulationOutputPersistenceStatuses.failed) {
    return GeneratedResultAssetStatuses.failedCollection;
  }
  return GeneratedResultAssetStatuses.pendingCollection;
}

export class SqliteRunCollectedResultPersistenceAdapter implements IRunCollectedResultPersistencePort {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: SqliteRunCollectedResultPersistenceAdapterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async persistCollectedResult(request: RunCollectedResultPersistenceRequest): Promise<RunCollectedResultPersistenceResult> {
    const occurredAt = normalizeOptional(request.occurredAt) ?? this.now().toISOString();
    const actorId = normalizeOptional(request.actorId) ?? "system:result-persistence";
    const workspaceId = normalizeOptional(request.workspaceId) ?? request.collectedResult.workspaceId;
    const systemId = resolveSystemId(request);

    const discoveredByDescriptorId = new Map<string, ImageManipulationDiscoveredOutputDescriptor>();
    for (const discovered of request.collectedResult.discoveredOutputs) {
      discoveredByDescriptorId.set(discovered.descriptorId, discovered);
    }

    const outputs: Array<{
      readonly outputId: string;
      readonly kind: "asset";
      readonly assetId: string;
      readonly label?: string;
    }> = [];
    const persistedResultAssetIds: string[] = [];

    let persistedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    for (const record of request.collectedResult.records) {
      const discovered = discoveredByDescriptorId.get(record.descriptorId);
      const outputId = normalizeOptional(discovered?.slotMatch?.outputId)
        ?? normalizeOptional(record.descriptorId)
        ?? `output-${toDeterministicSuffix(request.runId)}`;
      const resultAssetId = toSafeResultAssetId({
        runId: request.runId,
        descriptorId: record.descriptorId,
        discoveredOutput: discovered,
        persistedAssetId: record.persistence.status === ImageManipulationOutputPersistenceStatuses.persisted
          ? record.persistence.logicalAsset.assetId
          : undefined,
      });
      const status = resolveLifecycleStatus(record);
      const pendingSince = normalizeOptional(discovered?.discoveredAt)
        ?? normalizeOptional(request.collectedResult.collectedAt)
        ?? occurredAt;

      const saved = await this.dependencies.repository.saveResult(Object.freeze({
        resultAssetId,
        workspaceId,
        ownerUserId: actorId.startsWith("user:") ? actorId : undefined,
        runId: request.runId,
        systemId,
        workflowId: request.workflowId,
        workflowTemplateId: request.workflowTemplateId,
        executionNodeId: normalizeOptional(request.executionNodeId) ?? normalizeOptional(request.actorId),
        outputSlot: normalizeOptional(discovered?.slotMatch?.expectedBackendField)
          ?? normalizeOptional(discovered?.outputGroupId)
          ?? normalizeOptional(discovered?.outputRole)
          ?? "primary",
        inputAssetIds: resolveLineageInputAssetIds(request, discovered, record),
        workflowTemplateVersionId: request.workflowTemplateVersionId,
        workflowTemplateVersionTag: request.workflowTemplateVersionTag,
        systemSnapshotId: request.systemSnapshotId,
        systemVersionTag: request.systemVersionTag,
        parameterSnapshotId: request.parameterSnapshotId,
        selectedNodeId: request.selectedNodeId,
        executionAdapterKind: normalizeOptional(request.executionAdapterKind)
          ?? normalizeOptional(record.temporaryReference.backendFamily),
        executionBackendFamily: normalizeOptional(request.executionBackendFamily)
          ?? normalizeOptional(record.temporaryReference.backendFamily),
        visibility: AssetVisibilities.workspace,
        storageInstanceId: resolveStorageInstanceId(request, record),
        storageBindingReference: undefined,
        mediaType: resolveMediaType(discovered) as GeneratedResultPersistenceRecord["mediaType"],
        status,
        pendingSince,
        logicalAssetVersionId: record.persistence.status === ImageManipulationOutputPersistenceStatuses.persisted
          ? normalizeOptional(record.persistence.logicalAsset.logicalAssetReference)
          : undefined,
        persistedAt: record.persistence.status === ImageManipulationOutputPersistenceStatuses.persisted
          ? normalizeOptional(record.persistence.logicalAsset.persistedAt) ?? occurredAt
          : undefined,
        persistedBy: record.persistence.status === ImageManipulationOutputPersistenceStatuses.persisted
          ? actorId
          : undefined,
        previewReadyAt: undefined,
        previewReadyBy: undefined,
        failedAt: record.persistence.status === ImageManipulationOutputPersistenceStatuses.failed
          ? occurredAt
          : undefined,
        failedBy: record.persistence.status === ImageManipulationOutputPersistenceStatuses.failed
          ? actorId
          : undefined,
        failureCode: record.persistence.status === ImageManipulationOutputPersistenceStatuses.failed
          ? normalizeOptional(record.persistence.errorCode) ?? "result-persistence-failed"
          : undefined,
        failureMessage: record.persistence.status === ImageManipulationOutputPersistenceStatuses.failed
          ? normalizeOptional(record.persistence.message) ?? "Result persistence failed."
          : undefined,
        archivedAt: undefined,
        archivedBy: undefined,
        tenancy: createWorkspaceTenancyMetadata(workspaceId),
        createdAt: occurredAt,
        createdBy: actorId,
        lastModifiedAt: occurredAt,
        lastModifiedBy: actorId,
        revision: 1,
        schemaVersion: 1,
      }), {
        operationKey: `${request.operationKey}:result:${resultAssetId}`,
        context: Object.freeze({
          actorUserId: actorId,
          occurredAt,
          correlationId: request.operationKey,
          reason: "run-collected-result-persistence",
        }),
      });

      if (saved.record.status === GeneratedResultAssetStatuses.available || saved.record.status === GeneratedResultAssetStatuses.previewReady) {
        persistedCount += 1;
        persistedResultAssetIds.push(saved.record.resultAssetId);
        outputs.push(Object.freeze({
          outputId,
          kind: "asset",
          assetId: saved.record.resultAssetId,
          label: normalizeOptional(discovered?.outputRole),
        }));
      } else if (saved.record.status === GeneratedResultAssetStatuses.failedCollection) {
        failedCount += 1;
      } else {
        pendingCount += 1;
      }
    }

    const totalRecords = request.collectedResult.records.length;
    const status = totalRecords === 0
      ? RunCollectedResultPersistenceStatuses.skipped
      : failedCount > 0 && persistedCount === 0
        ? RunCollectedResultPersistenceStatuses.failed
        : failedCount > 0 || pendingCount > 0
          ? RunCollectedResultPersistenceStatuses.partiallyPersisted
          : RunCollectedResultPersistenceStatuses.persisted;

    const outputAvailabilityHint = persistedCount === 0
      ? failedCount > 0
        ? "degraded"
        : "none"
      : (failedCount > 0 || pendingCount > 0)
        ? "partial"
        : "available";

    const terminalQualityHint = status === RunCollectedResultPersistenceStatuses.failed
      ? "degraded"
      : status === RunCollectedResultPersistenceStatuses.partiallyPersisted
        ? "partial"
        : persistedCount > 0
          ? "standard"
          : "degraded";

    return Object.freeze({
      status,
      outputs: Object.freeze(outputs),
      outputAvailabilityHint,
      terminalQualityHint,
      internalDiagnostics: Object.freeze({
        totalRecords,
        persistedCount,
        pendingCount,
        failedCount,
        persistedResultAssetIds: Object.freeze(persistedResultAssetIds),
      }),
    });
  }
}
