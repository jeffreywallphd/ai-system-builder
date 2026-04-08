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
import {
  GeneratedResultDerivativeAvailabilityStatuses,
  GeneratedResultPreviewKinds,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import {
  ImageManipulationFailureDispositions,
  ImageManipulationFailureSummaryCategories,
  ImageManipulationIssueKinds,
  ImageManipulationIssueLayers,
  createImageManipulationIssueClassification,
  type ImageManipulationIssueClassification,
} from "@shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy";
import { deriveImageManipulationRetryRecoveryContractFromClassification } from "@shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts";
import { createWorkspaceTenancyMetadata } from "@shared/persistence/PersistenceTenancyMetadataFactory";
import type {
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";

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

function toPreviewDerivativeId(resultAssetId: string, previewKind: string): string {
  return `preview-${toDeterministicSuffix(`${resultAssetId}:${previewKind}`)}`;
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

function classifyOperationalFailure(input: {
  readonly layer: typeof ImageManipulationIssueLayers[keyof typeof ImageManipulationIssueLayers];
  readonly reason: string;
  readonly summaryCategory: typeof ImageManipulationFailureSummaryCategories[keyof typeof ImageManipulationFailureSummaryCategories];
  readonly retryable: boolean;
  readonly degraded?: boolean;
}): {
  readonly classification: ImageManipulationIssueClassification;
  readonly recovery: ReturnType<typeof deriveImageManipulationRetryRecoveryContractFromClassification>;
} {
  const classification = createImageManipulationIssueClassification({
    layer: input.layer,
    kind: ImageManipulationIssueKinds.operational,
    summaryCategory: input.summaryCategory,
    disposition: input.retryable
      ? ImageManipulationFailureDispositions.retryable
      : ImageManipulationFailureDispositions.terminal,
    reason: input.reason,
    degraded: input.degraded ?? input.retryable,
  });
  return Object.freeze({
    classification,
    recovery: deriveImageManipulationRetryRecoveryContractFromClassification({
      classification,
      retryable: input.retryable,
    }),
  });
}

function isLikelyTemporaryStorageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (!message) {
    return false;
  }
  return message.includes("busy")
    || message.includes("locked")
    || message.includes("timeout")
    || message.includes("tempor")
    || message.includes("connect")
    || message.includes("unavail");
}

function toResultFailureReason(record: ImageManipulationCollectedOutputRecord): string {
  if (record.persistence.status === ImageManipulationOutputPersistenceStatuses.failed) {
    const code = normalizeOptional(record.persistence.errorCode);
    if (code) {
      return code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
  }
  return "result-persistence-failed";
}

function createPendingPreviewRecord(input: {
  readonly result: GeneratedResultPersistenceRecord;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}): GeneratedResultPreviewPersistenceRecord {
  return Object.freeze({
    derivativeId: toPreviewDerivativeId(input.result.resultAssetId, GeneratedResultPreviewKinds.displaySafe),
    resultAssetId: input.result.resultAssetId,
    resultLogicalAssetVersionId: input.result.logicalAssetVersionId,
    previewKind: GeneratedResultPreviewKinds.displaySafe,
    availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.pending,
    isPrimaryPreview: true,
    protectedResourceId: undefined,
    accessHandle: undefined,
    mediaType: input.result.mediaType,
    width: undefined,
    height: undefined,
    byteSize: undefined,
    generatedAt: undefined,
    failureCode: undefined,
    failureMessage: undefined,
    tenancy: createWorkspaceTenancyMetadata(input.workspaceId),
    createdAt: input.occurredAt,
    createdBy: input.actorId,
    lastModifiedAt: input.occurredAt,
    lastModifiedBy: input.actorId,
    revision: 1,
    schemaVersion: 1,
  });
}

function createFailedPreviewRecord(input: {
  readonly pendingRecord: GeneratedResultPreviewPersistenceRecord;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly failureCode: string;
  readonly failureMessage: string;
}): GeneratedResultPreviewPersistenceRecord {
  return Object.freeze({
    ...input.pendingRecord,
    availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.failed,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    generatedAt: undefined,
    lastModifiedAt: input.occurredAt,
    lastModifiedBy: input.actorId,
  });
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
    const perRecordDiagnostics: Array<Readonly<Record<string, unknown>>> = [];

    let persistedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let previewPendingCount = 0;
    let previewFailedCount = 0;
    let previewProvisioningUnavailableCount = 0;
    let storageUnavailableCount = 0;

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

      const baseRecord: GeneratedResultPersistenceRecord = Object.freeze({
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
          ? toResultFailureReason(record)
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
      });

      let saved: Awaited<ReturnType<IGeneratedResultPersistenceRepository["saveResult"]>> | undefined;
      try {
        saved = await this.dependencies.repository.saveResult(baseRecord, {
        operationKey: `${request.operationKey}:result:${resultAssetId}`,
        context: Object.freeze({
          actorUserId: actorId,
          occurredAt,
          correlationId: request.operationKey,
          reason: "run-collected-result-persistence",
        }),
        });
      } catch (error) {
        const retryable = isLikelyTemporaryStorageError(error);
        const collectionFailure = classifyOperationalFailure({
          layer: ImageManipulationIssueLayers.resultCollection,
          reason: retryable ? "result-storage-temporarily-unavailable" : "result-storage-write-failed",
          summaryCategory: retryable
            ? ImageManipulationFailureSummaryCategories.connectivity
            : ImageManipulationFailureSummaryCategories.output,
          retryable,
          degraded: true,
        });
        const failureCode = collectionFailure.classification.issueCode;
        const failureMessage = retryable
          ? "Result persistence is temporarily unavailable."
          : "Result persistence failed.";

        if (retryable) {
          storageUnavailableCount += 1;
        }

        try {
          const failedRecord = Object.freeze({
            ...baseRecord,
            status: GeneratedResultAssetStatuses.failedCollection,
            logicalAssetVersionId: undefined,
            persistedAt: undefined,
            persistedBy: undefined,
            previewReadyAt: undefined,
            previewReadyBy: undefined,
            failedAt: occurredAt,
            failedBy: actorId,
            failureCode,
            failureMessage,
            lastModifiedAt: occurredAt,
            lastModifiedBy: actorId,
          });
          saved = await this.dependencies.repository.saveResult(failedRecord, {
            operationKey: `${request.operationKey}:result:${resultAssetId}:fallback-failed`,
            context: Object.freeze({
              actorUserId: actorId,
              occurredAt,
              correlationId: request.operationKey,
              reason: "run-collected-result-persistence-fallback-failure-record",
              metadata: Object.freeze({
                originalError: error instanceof Error ? error.message : "Unknown error",
              }),
            }),
          });
        } catch {
          failedCount += 1;
          perRecordDiagnostics.push(Object.freeze({
            descriptorId: record.descriptorId,
            resultAssetId,
            persisted: false,
            previewProvisioned: false,
            failure: Object.freeze({
              code: failureCode,
              message: failureMessage,
              classification: collectionFailure.classification,
              recovery: collectionFailure.recovery,
              originalError: error instanceof Error ? error.message : "Unknown error",
              fallbackFailureRecordPersisted: false,
            }),
          }));
          continue;
        }
      }

      if (!saved) {
        failedCount += 1;
        perRecordDiagnostics.push(Object.freeze({
          descriptorId: record.descriptorId,
          resultAssetId,
          persisted: false,
          previewProvisioned: false,
          failure: Object.freeze({
            code: "im.result.operational.result-storage-write-failed",
            message: "Result persistence failed before a record was produced.",
          }),
        }));
        continue;
      }

      if (saved.record.status === GeneratedResultAssetStatuses.available || saved.record.status === GeneratedResultAssetStatuses.previewReady) {
        persistedCount += 1;
        persistedResultAssetIds.push(saved.record.resultAssetId);
        outputs.push(Object.freeze({
          outputId,
          kind: "asset",
          assetId: saved.record.resultAssetId,
          label: normalizeOptional(discovered?.outputRole),
        }));

        const pendingPreview = createPendingPreviewRecord({
          result: saved.record,
          workspaceId,
          actorId,
          occurredAt,
        });
        try {
          await this.dependencies.repository.savePreview(pendingPreview, {
            operationKey: `${request.operationKey}:preview:${pendingPreview.derivativeId}`,
            context: Object.freeze({
              actorUserId: actorId,
              occurredAt,
              correlationId: request.operationKey,
              reason: "run-collected-result-preview-pending",
            }),
          });
          previewPendingCount += 1;
          perRecordDiagnostics.push(Object.freeze({
            descriptorId: record.descriptorId,
            resultAssetId: saved.record.resultAssetId,
            persisted: true,
            previewProvisioned: true,
            previewStatus: GeneratedResultDerivativeAvailabilityStatuses.pending,
          }));
        } catch (error) {
          const retryable = isLikelyTemporaryStorageError(error);
          const previewFailure = classifyOperationalFailure({
            layer: ImageManipulationIssueLayers.previewGeneration,
            reason: retryable ? "preview-persistence-temporarily-unavailable" : "preview-persistence-failed",
            summaryCategory: retryable
              ? ImageManipulationFailureSummaryCategories.connectivity
              : ImageManipulationFailureSummaryCategories.output,
            retryable,
            degraded: true,
          });
          const failureCode = previewFailure.classification.issueCode;
          const failureMessage = retryable
            ? "Preview provisioning is temporarily unavailable."
            : "Preview provisioning failed.";
          try {
            await this.dependencies.repository.savePreview(createFailedPreviewRecord({
              pendingRecord: pendingPreview,
              actorId,
              occurredAt,
              failureCode,
              failureMessage,
            }), {
              operationKey: `${request.operationKey}:preview:${pendingPreview.derivativeId}:failed`,
              context: Object.freeze({
                actorUserId: actorId,
                occurredAt,
                correlationId: request.operationKey,
                reason: "run-collected-result-preview-failed",
                metadata: Object.freeze({
                  originalError: error instanceof Error ? error.message : "Unknown error",
                }),
              }),
            });
            previewFailedCount += 1;
            perRecordDiagnostics.push(Object.freeze({
              descriptorId: record.descriptorId,
              resultAssetId: saved.record.resultAssetId,
              persisted: true,
              previewProvisioned: false,
              previewStatus: GeneratedResultDerivativeAvailabilityStatuses.failed,
              failure: Object.freeze({
                code: failureCode,
                message: failureMessage,
                classification: previewFailure.classification,
                recovery: previewFailure.recovery,
                originalError: error instanceof Error ? error.message : "Unknown error",
              }),
            }));
          } catch {
            previewProvisioningUnavailableCount += 1;
            perRecordDiagnostics.push(Object.freeze({
              descriptorId: record.descriptorId,
              resultAssetId: saved.record.resultAssetId,
              persisted: true,
              previewProvisioned: false,
              previewStatus: "untracked",
              failure: Object.freeze({
                code: failureCode,
                message: failureMessage,
                classification: previewFailure.classification,
                recovery: previewFailure.recovery,
                originalError: error instanceof Error ? error.message : "Unknown error",
                failedPreviewRecordPersisted: false,
              }),
            }));
          }
        }
      } else if (saved.record.status === GeneratedResultAssetStatuses.failedCollection) {
        failedCount += 1;
        perRecordDiagnostics.push(Object.freeze({
          descriptorId: record.descriptorId,
          resultAssetId: saved.record.resultAssetId,
          persisted: false,
          previewProvisioned: false,
          failure: Object.freeze({
            code: saved.record.failureCode,
            message: saved.record.failureMessage,
          }),
        }));
      } else {
        pendingCount += 1;
        perRecordDiagnostics.push(Object.freeze({
          descriptorId: record.descriptorId,
          resultAssetId: saved.record.resultAssetId,
          persisted: false,
          previewProvisioned: false,
          pending: true,
        }));
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
      : status === RunCollectedResultPersistenceStatuses.partiallyPersisted || previewFailedCount > 0
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
        previewPendingCount,
        previewFailedCount,
        previewProvisioningUnavailableCount,
        storageUnavailableCount,
        persistedResultAssetIds: Object.freeze(persistedResultAssetIds),
        perRecordDiagnostics: Object.freeze(perRecordDiagnostics),
      }),
    });
  }
}
