import { createHash } from "node:crypto";
import type { IGeneratedResultPersistenceRepository } from "@application/generated-results/ports/IGeneratedResultPersistenceRepository";
import {
  GeneratedResultAuditEventTypes,
  GeneratedResultAuditOutcomes,
  publishGeneratedResultAuditEventBestEffort,
  type GeneratedResultAuditSink,
} from "@application/generated-results/ports/GeneratedResultAuditPort";
import type { IGenerateGeneratedResultPreviewUseCase } from "@application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCaseContracts";
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
import {
  ConsolePersistenceDiagnosticsLogger,
  type IPersistenceDiagnosticsLogger,
  type PersistenceDiagnosticsLogLevel,
} from "@infrastructure/logging/PersistenceDiagnosticsLogger";
import {
  createImageManipulationSliceCorrelation,
  deriveImageManipulationResilienceDiagnostics,
  IMAGE_MANIPULATION_SLICE_NAME,
  type ImageManipulationSliceResilienceDiagnostic,
} from "@infrastructure/logging/ImageManipulationSliceDiagnostics";
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
  readonly generateGeneratedResultPreviewUseCase?: IGenerateGeneratedResultPreviewUseCase;
  readonly auditSink?: GeneratedResultAuditSink;
  readonly diagnosticsLogger?: IPersistenceDiagnosticsLogger;
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
  private readonly diagnosticsLogger: IPersistenceDiagnosticsLogger;

  public constructor(private readonly dependencies: SqliteRunCollectedResultPersistenceAdapterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.diagnosticsLogger = dependencies.diagnosticsLogger ?? new ConsolePersistenceDiagnosticsLogger();
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
    let previewGeneratedCount = 0;
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
        const resultSaveResilience = deriveImageManipulationResilienceDiagnostics({
          diagnostics: [Object.freeze({
            code: failureCode,
            category: retryable ? "degraded" : "operational",
            summary: failureMessage,
            retryable: collectionFailure.recovery.retryEligible,
            degraded: collectionFailure.classification.degraded,
            recoveryKind: collectionFailure.recovery.recoveryKind,
            retryAfterMs: collectionFailure.recovery.retryAfterMs,
            scope: "result-collection",
            state: "result-persistence-failed",
          })],
          defaultCode: failureCode,
          defaultSummary: failureMessage,
        });

        if (retryable) {
          storageUnavailableCount += 1;
        }
        this.recordPersistenceDiagnostic({
          level: retryable ? "warn" : "error",
          operation: "persist-collected-result.save-result",
          code: failureCode,
          retryable,
          occurredAt,
          request,
          resultAssetId,
          resilience: resultSaveResilience,
          details: Object.freeze({
            message: failureMessage,
            outputDescriptorId: record.descriptorId,
            event: "result-save-failed",
            errorSummary: toSafeErrorSummary(error),
            classification: collectionFailure.classification,
            recovery: collectionFailure.recovery,
          }),
        });

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
          this.recordPersistenceDiagnostic({
            level: "error",
            operation: "persist-collected-result.save-result-fallback",
            code: failureCode,
            retryable: false,
            occurredAt,
            request,
            resultAssetId,
            resilience: resultSaveResilience,
            details: Object.freeze({
              message: "Failed to persist fallback failed-collection record after save failure.",
              outputDescriptorId: record.descriptorId,
              event: "result-save-fallback-failed",
              fallbackFailureRecordPersisted: false,
            }),
          });
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
        this.recordPersistenceDiagnostic({
          level: "error",
          operation: "persist-collected-result.save-result",
          code: "im.result.operational.result-storage-write-failed",
          retryable: false,
          occurredAt,
          request,
          resultAssetId,
          resilience: deriveImageManipulationResilienceDiagnostics({
            defaultCode: "im.result.operational.result-storage-write-failed",
            defaultSummary: "Result persistence failed before a record was produced.",
            defaultCategory: "operational",
            defaultRetryable: false,
            defaultDegraded: true,
          }),
          details: Object.freeze({
            message: "Result persistence failed before a record was produced.",
            outputDescriptorId: record.descriptorId,
            event: "result-save-missing-record",
          }),
        });
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

      await this.publishResultPersistenceAuditEvent({
        request,
        occurredAt,
        result: saved.record,
        outcome: saved.record.status === GeneratedResultAssetStatuses.failedCollection
          ? GeneratedResultAuditOutcomes.failed
          : GeneratedResultAuditOutcomes.success,
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

        if (!this.dependencies.generateGeneratedResultPreviewUseCase) {
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
            await this.publishPreviewProvisioningAuditEvent({
              request,
              occurredAt,
              result: saved.record,
              outcome: GeneratedResultAuditOutcomes.success,
              details: Object.freeze({
                previewKind: pendingPreview.previewKind,
                previewStatus: GeneratedResultDerivativeAvailabilityStatuses.pending,
                derivativeId: pendingPreview.derivativeId,
              }),
            });
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
            const previewResilience = deriveImageManipulationResilienceDiagnostics({
              diagnostics: [Object.freeze({
                code: failureCode,
                category: retryable ? "degraded" : "operational",
                summary: failureMessage,
                retryable: previewFailure.recovery.retryEligible,
                degraded: previewFailure.classification.degraded,
                recoveryKind: previewFailure.recovery.recoveryKind,
                retryAfterMs: previewFailure.recovery.retryAfterMs,
                scope: "preview-generation",
                state: "preview-persistence-failed",
              })],
              defaultCode: failureCode,
              defaultSummary: failureMessage,
            });
            this.recordPersistenceDiagnostic({
              level: retryable ? "warn" : "error",
              operation: "persist-collected-result.save-preview",
              code: failureCode,
              retryable,
              occurredAt,
              request,
              resultAssetId: saved.record.resultAssetId,
              previewDerivativeId: pendingPreview.derivativeId,
              resilience: previewResilience,
              details: Object.freeze({
                message: failureMessage,
                outputDescriptorId: record.descriptorId,
                event: "preview-pending-save-failed",
                errorSummary: toSafeErrorSummary(error),
                classification: previewFailure.classification,
                recovery: previewFailure.recovery,
              }),
            });
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
              await this.publishPreviewProvisioningAuditEvent({
                request,
                occurredAt,
                result: saved.record,
                outcome: GeneratedResultAuditOutcomes.failed,
                reasonCode: failureCode,
                details: Object.freeze({
                  previewKind: pendingPreview.previewKind,
                  previewStatus: GeneratedResultDerivativeAvailabilityStatuses.failed,
                  derivativeId: pendingPreview.derivativeId,
                }),
              });
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
              this.recordPersistenceDiagnostic({
                level: "error",
                operation: "persist-collected-result.save-preview-fallback",
                code: failureCode,
                retryable: false,
                occurredAt,
                request,
                resultAssetId: saved.record.resultAssetId,
                previewDerivativeId: pendingPreview.derivativeId,
                resilience: previewResilience,
                details: Object.freeze({
                  message: "Failed to persist preview failed state after pending preview save failure.",
                  outputDescriptorId: record.descriptorId,
                  event: "preview-failed-record-save-failed",
                  failedPreviewRecordPersisted: false,
                }),
              });
              previewProvisioningUnavailableCount += 1;
              await this.publishPreviewProvisioningAuditEvent({
                request,
                occurredAt,
                result: saved.record,
                outcome: GeneratedResultAuditOutcomes.failed,
                reasonCode: failureCode,
                details: Object.freeze({
                  previewKind: pendingPreview.previewKind,
                  previewStatus: "untracked",
                  derivativeId: pendingPreview.derivativeId,
                }),
              });
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
        } else {
          const previewOutcome = await this.dependencies.generateGeneratedResultPreviewUseCase.execute({
            resultAssetId: saved.record.resultAssetId,
            workspaceId,
            actorUserId: actorId,
            operationKey: `${request.operationKey}:preview-generation:${saved.record.resultAssetId}`,
            previewKind: GeneratedResultPreviewKinds.displaySafe,
            correlationId: request.operationKey,
            occurredAt,
          });
          if (previewOutcome.ok) {
            previewGeneratedCount += 1;
            perRecordDiagnostics.push(Object.freeze({
              descriptorId: record.descriptorId,
              resultAssetId: saved.record.resultAssetId,
              persisted: true,
              previewProvisioned: true,
              previewStatus: GeneratedResultDerivativeAvailabilityStatuses.available,
              previewDerivativeId: previewOutcome.value.derivativeId,
              previewKind: previewOutcome.value.previewKind,
            }));
          } else {
            previewFailedCount += 1;
            perRecordDiagnostics.push(Object.freeze({
              descriptorId: record.descriptorId,
              resultAssetId: saved.record.resultAssetId,
              persisted: true,
              previewProvisioned: false,
              previewStatus: GeneratedResultDerivativeAvailabilityStatuses.failed,
              failure: Object.freeze({
                code: previewOutcome.error.code,
                message: previewOutcome.error.message,
                retryable: previewOutcome.error.retryable,
              }),
            }));
            this.recordPersistenceDiagnostic({
              level: previewOutcome.error.retryable ? "warn" : "error",
              operation: "persist-collected-result.generate-preview",
              code: previewOutcome.error.code,
              retryable: previewOutcome.error.retryable,
              occurredAt,
              request,
              resultAssetId: saved.record.resultAssetId,
              resilience: deriveImageManipulationResilienceDiagnostics({
                diagnostics: [Object.freeze({
                  code: previewOutcome.error.code,
                  category: previewOutcome.error.retryable ? "degraded" : "operational",
                  summary: previewOutcome.error.message,
                  retryable: previewOutcome.error.retryable,
                  degraded: previewOutcome.error.retryable,
                  scope: "preview-generation",
                  state: "preview-generation-failed",
                })],
                defaultCode: previewOutcome.error.code,
                defaultSummary: previewOutcome.error.message,
              }),
              details: Object.freeze({
                message: previewOutcome.error.message,
                outputDescriptorId: record.descriptorId,
                event: "preview-generation-failed",
              }),
            });
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
        previewGeneratedCount,
        previewFailedCount,
        previewProvisioningUnavailableCount,
        storageUnavailableCount,
        persistedResultAssetIds: Object.freeze(persistedResultAssetIds),
        perRecordDiagnostics: Object.freeze(perRecordDiagnostics),
      }),
    });
  }

  private recordPersistenceDiagnostic(input: {
    readonly level: PersistenceDiagnosticsLogLevel;
    readonly operation: string;
    readonly code: string;
    readonly retryable: boolean;
    readonly occurredAt: string;
    readonly request: RunCollectedResultPersistenceRequest;
    readonly resultAssetId?: string;
    readonly previewDerivativeId?: string;
    readonly resilience: ReadonlyArray<ImageManipulationSliceResilienceDiagnostic>;
    readonly details: Readonly<Record<string, unknown>>;
  }): void {
    const correlation = createImageManipulationSliceCorrelation({
      requestId: normalizeOptional(input.request.operationKey),
      correlationId: normalizeOptional(input.request.operationKey),
      workspaceId: normalizeOptional(input.request.workspaceId) ?? normalizeOptional(input.request.collectedResult.workspaceId),
      runId: normalizeOptional(input.request.runId),
      workflowId: normalizeOptional(input.request.workflowId),
      systemId: normalizeOptional(input.request.systemId),
      executionJobId: normalizeOptional(input.request.collectedResult.executionJobId),
      operationKey: normalizeOptional(input.request.operationKey),
      resultAssetId: normalizeOptional(input.resultAssetId),
      previewDerivativeId: normalizeOptional(input.previewDerivativeId),
    });

    const event = Object.freeze({
      type: "persistence-diagnostic" as const,
      slice: IMAGE_MANIPULATION_SLICE_NAME,
      level: input.level,
      repository: "generated-result-persistence",
      operation: input.operation,
      code: input.code,
      retryable: input.retryable,
      occurredAt: input.occurredAt,
      correlation,
      resilience: input.resilience,
      details: Object.freeze({
        ...input.details,
        correlation,
      }),
    });

    if (input.level === "error") {
      this.diagnosticsLogger.error(event);
      return;
    }
    if (input.level === "warn") {
      this.diagnosticsLogger.warn(event);
      return;
    }
    this.diagnosticsLogger.info(event);
  }

  private async publishResultPersistenceAuditEvent(input: {
    readonly request: RunCollectedResultPersistenceRequest;
    readonly occurredAt: string;
    readonly result: GeneratedResultPersistenceRecord;
    readonly outcome: typeof GeneratedResultAuditOutcomes[keyof typeof GeneratedResultAuditOutcomes];
    readonly reasonCode?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishGeneratedResultAuditEventBestEffort(this.dependencies.auditSink, {
      type: GeneratedResultAuditEventTypes.resultPersisted,
      occurredAt: input.occurredAt,
      workspaceId: input.request.workspaceId,
      actorUserId: input.request.actorId,
      correlationId: input.request.operationKey,
      operationKey: input.request.operationKey,
      outcome: input.outcome,
      result: Object.freeze({
        resultAssetId: input.result.resultAssetId,
        runId: input.result.runId,
        workflowId: input.result.workflowId,
        systemId: input.result.systemId,
        executionNodeId: input.result.executionNodeId,
        storageInstanceId: input.result.storageInstanceId,
        visibility: input.result.visibility,
        lifecycleStatus: input.result.status,
        mediaType: input.result.mediaType,
      }),
      details: Object.freeze({
        reasonCode: input.reasonCode,
        ...(input.details ?? {}),
      }),
    });
  }

  private async publishPreviewProvisioningAuditEvent(input: {
    readonly request: RunCollectedResultPersistenceRequest;
    readonly occurredAt: string;
    readonly result: GeneratedResultPersistenceRecord;
    readonly outcome: typeof GeneratedResultAuditOutcomes[keyof typeof GeneratedResultAuditOutcomes];
    readonly reasonCode?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishGeneratedResultAuditEventBestEffort(this.dependencies.auditSink, {
      type: GeneratedResultAuditEventTypes.previewGenerationRecorded,
      occurredAt: input.occurredAt,
      workspaceId: input.request.workspaceId,
      actorUserId: input.request.actorId,
      correlationId: input.request.operationKey,
      operationKey: input.request.operationKey,
      outcome: input.outcome,
      result: Object.freeze({
        resultAssetId: input.result.resultAssetId,
        runId: input.result.runId,
        workflowId: input.result.workflowId,
        systemId: input.result.systemId,
        executionNodeId: input.result.executionNodeId,
        storageInstanceId: input.result.storageInstanceId,
        visibility: input.result.visibility,
        lifecycleStatus: input.result.status,
        mediaType: input.result.mediaType,
      }),
      details: Object.freeze({
        reasonCode: input.reasonCode,
        ...(input.details ?? {}),
      }),
    });
  }
}

const UnsafePathFragmentPattern = /(?:[A-Za-z]:[\\/][^\s]*|\\\\[^\s]+|\/[^\s]+)/g;
const UnsafeTokenFragmentPattern = /\b(?:Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g;

function toSafeErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }

  const normalized = normalizeOptional(error.message) ?? "Unknown error";
  return normalized
    .replace(UnsafePathFragmentPattern, "[REDACTED]")
    .replace(UnsafeTokenFragmentPattern, "[REDACTED]");
}
