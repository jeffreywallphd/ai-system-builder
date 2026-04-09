import { GeneratedResultAssetStatuses, type GeneratedResultAssetStatus } from "@domain/image-assets/GeneratedResultAssetDomain";
import { GeneratedResultDerivativeAvailabilityStatuses } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import {
  GeneratedResultPreviewStates,
  GeneratedResultRetrievalStates,
  type GeneratedResultPreviewState,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";
import type {
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import type { GeneratedResultLineageRecord } from "../ports/IGeneratedResultPersistenceRepository";
import type {
  GeneratedResultMetadataDetail,
  GeneratedResultMetadataLineageSummary,
  GeneratedResultMetadataPreviewSummary,
  GeneratedResultMetadataRetrievalSummary,
  GeneratedResultMetadataSummary,
} from "./GeneratedResultMetadataReadUseCaseContracts";

function toPreviewSummary(
  input: ReadonlyArray<GeneratedResultPreviewPersistenceRecord>,
): GeneratedResultMetadataPreviewSummary {
  const sorted = [...input].sort((left, right) => {
    if (left.isPrimaryPreview === right.isPrimaryPreview) {
      return left.derivativeId.localeCompare(right.derivativeId);
    }
    return left.isPrimaryPreview ? -1 : 1;
  });
  const primary = sorted[0];
  if (!primary) {
    return Object.freeze({
      state: GeneratedResultPreviewStates.unavailable,
      hasPreview: false,
    });
  }

  const availabilityStatus = primary.availabilityStatus;
  let state: GeneratedResultPreviewState;
  if (
    availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.available
    || availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.stale
  ) {
    state = GeneratedResultPreviewStates.available;
  } else if (availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.pending) {
    state = GeneratedResultPreviewStates.pending;
  } else {
    state = GeneratedResultPreviewStates.failed;
  }

  return Object.freeze({
    state,
    hasPreview: state === GeneratedResultPreviewStates.available,
    primaryPreviewKind: primary.previewKind,
    availabilityStatus: primary.availabilityStatus,
  });
}

function toRetrievalSummary(
  record: GeneratedResultPersistenceRecord,
): GeneratedResultMetadataRetrievalSummary {
  if (
    (record.status === GeneratedResultAssetStatuses.available
      || record.status === GeneratedResultAssetStatuses.previewReady
      || record.status === GeneratedResultAssetStatuses.archived)
    && Boolean(record.mediaType && record.logicalAssetVersionId)
  ) {
    return Object.freeze({
      state: GeneratedResultRetrievalStates.available,
    });
  }

  if (record.status === GeneratedResultAssetStatuses.pendingCollection) {
    return Object.freeze({
      state: GeneratedResultRetrievalStates.temporarilyUnavailable,
      reasonCode: "result-pending-collection",
      retryable: true,
    });
  }

  if (record.status === GeneratedResultAssetStatuses.failedCollection) {
    return Object.freeze({
      state: GeneratedResultRetrievalStates.resultUnavailable,
      reasonCode: record.failureCode ?? "result-collection-failed",
      retryable: false,
    });
  }

  return Object.freeze({
    state: GeneratedResultRetrievalStates.unavailable,
    reasonCode: "result-original-unavailable",
    retryable: false,
  });
}

function toLineageSummary(
  input: Pick<
    GeneratedResultPersistenceRecord,
    | "resultAssetId"
    | "runId"
    | "systemId"
    | "workflowId"
    | "workflowTemplateId"
    | "executionNodeId"
    | "outputSlot"
    | "inputAssetIds"
    | "workflowTemplateVersionId"
    | "systemSnapshotId"
    | "parameterSnapshotId"
    | "selectedNodeId"
  >,
): GeneratedResultMetadataLineageSummary {
  return Object.freeze({
    resultAssetId: input.resultAssetId,
    runId: input.runId,
    systemId: input.systemId,
    workflowId: input.workflowId,
    workflowTemplateId: input.workflowTemplateId,
    executionNodeId: input.executionNodeId,
    outputSlot: input.outputSlot,
    inputAssetCount: input.inputAssetIds.length,
    hasWorkflowTemplateVersion: Boolean(input.workflowTemplateVersionId),
    hasSystemSnapshot: Boolean(input.systemSnapshotId),
    hasParameterSnapshot: Boolean(input.parameterSnapshotId),
    hasSelectedNode: Boolean(input.selectedNodeId),
  });
}

export function toGeneratedResultMetadataSummary(input: {
  readonly record: GeneratedResultPersistenceRecord;
  readonly previews: ReadonlyArray<GeneratedResultPreviewPersistenceRecord>;
}): GeneratedResultMetadataSummary {
  const preview = toPreviewSummary(input.previews);
  const retrieval = toRetrievalSummary(input.record);
  const lineage = toLineageSummary(input.record);

  return Object.freeze({
    resultAssetId: input.record.resultAssetId,
    workspaceId: input.record.workspaceId,
    ownerUserId: input.record.ownerUserId,
    runId: input.record.runId,
    systemId: input.record.systemId,
    workflowId: input.record.workflowId,
    workflowTemplateId: input.record.workflowTemplateId,
    executionNodeId: input.record.executionNodeId,
    outputSlot: input.record.outputSlot,
    status: input.record.status,
    mediaType: input.record.mediaType,
    visibility: input.record.visibility,
    createdAt: input.record.createdAt,
    updatedAt: input.record.lastModifiedAt,
    preview,
    retrieval,
    lineage,
  });
}

function normalizeLineage(
  record: GeneratedResultPersistenceRecord,
  lineage: GeneratedResultLineageRecord | undefined,
) {
  const source = lineage ?? {
    resultAssetId: record.resultAssetId,
    runId: record.runId,
    systemId: record.systemId,
    workflowId: record.workflowId,
    workflowTemplateId: record.workflowTemplateId,
    executionNodeId: record.executionNodeId,
    outputSlot: record.outputSlot,
    inputAssetIds: record.inputAssetIds,
    workflowTemplateVersionId: record.workflowTemplateVersionId,
    workflowTemplateVersionTag: record.workflowTemplateVersionTag,
    systemSnapshotId: record.systemSnapshotId,
    systemVersionTag: record.systemVersionTag,
    parameterSnapshotId: record.parameterSnapshotId,
    selectedNodeId: record.selectedNodeId,
    executionAdapterKind: record.executionAdapterKind,
    executionBackendFamily: record.executionBackendFamily,
    updatedAt: record.lastModifiedAt,
  };

  return Object.freeze({
    summary: Object.freeze({
      resultAssetId: source.resultAssetId,
      runId: source.runId,
      systemId: source.systemId,
      workflowId: source.workflowId,
      workflowTemplateId: source.workflowTemplateId,
      executionNodeId: source.executionNodeId,
      outputSlot: source.outputSlot,
      inputAssetCount: source.inputAssetIds.length,
      hasWorkflowTemplateVersion: Boolean(source.workflowTemplateVersionId),
      hasSystemSnapshot: Boolean(source.systemSnapshotId),
      hasParameterSnapshot: Boolean(source.parameterSnapshotId),
      hasSelectedNode: Boolean(source.selectedNodeId),
    }),
    inputAssetIds: Object.freeze([...source.inputAssetIds]),
    workflowTemplateVersionId: source.workflowTemplateVersionId,
    workflowTemplateVersionTag: source.workflowTemplateVersionTag,
    systemSnapshotId: source.systemSnapshotId,
    systemVersionTag: source.systemVersionTag,
    parameterSnapshotId: source.parameterSnapshotId,
    selectedNodeId: source.selectedNodeId,
    executionAdapterKind: source.executionAdapterKind,
    executionBackendFamily: source.executionBackendFamily,
    updatedAt: source.updatedAt,
  });
}

export function toGeneratedResultMetadataDetail(input: {
  readonly record: GeneratedResultPersistenceRecord;
  readonly previews: ReadonlyArray<GeneratedResultPreviewPersistenceRecord>;
  readonly lineage: GeneratedResultLineageRecord | undefined;
}): GeneratedResultMetadataDetail {
  const lineage = normalizeLineage(input.record, input.lineage);
  const summary = toGeneratedResultMetadataSummary({
    record: input.record,
    previews: input.previews,
  });

  return Object.freeze({
    ...summary,
    lineage: lineage.summary,
    sharingPolicyRef: input.record.sharingPolicyId
      ? Object.freeze({
        policyId: input.record.sharingPolicyId,
        policyVersion: input.record.sharingPolicyVersion,
      })
      : undefined,
    storage: Object.freeze({
      storageInstanceId: input.record.storageInstanceId,
      storageBindingReference: input.record.storageBindingReference,
    }),
    lifecycle: Object.freeze({
      pendingSince: input.record.pendingSince,
      logicalAssetVersionId: input.record.logicalAssetVersionId,
      persistedAt: input.record.persistedAt,
      persistedBy: input.record.persistedBy,
      previewReadyAt: input.record.previewReadyAt,
      previewReadyBy: input.record.previewReadyBy,
      failedAt: input.record.failedAt,
      failedBy: input.record.failedBy,
      failureCode: input.record.failureCode,
      failureMessage: input.record.failureMessage,
      archivedAt: input.record.archivedAt,
      archivedBy: input.record.archivedBy,
    }),
    previewDescriptors: Object.freeze(input.previews
      .map((preview) => Object.freeze({
        derivativeId: preview.derivativeId,
        previewKind: preview.previewKind,
        availabilityStatus: preview.availabilityStatus,
        isPrimaryPreview: preview.isPrimaryPreview,
        mediaType: preview.mediaType,
        width: preview.width,
        height: preview.height,
        byteSize: preview.byteSize,
        protectedResourceId: preview.protectedResourceId,
        accessHandle: preview.accessHandle,
        generatedAt: preview.generatedAt,
        failureCode: preview.failureCode,
        failureMessage: preview.failureMessage,
      }))),
    lineageDetail: {
      inputAssetIds: lineage.inputAssetIds,
      workflowTemplateVersionId: lineage.workflowTemplateVersionId,
      workflowTemplateVersionTag: lineage.workflowTemplateVersionTag,
      systemSnapshotId: lineage.systemSnapshotId,
      systemVersionTag: lineage.systemVersionTag,
      parameterSnapshotId: lineage.parameterSnapshotId,
      selectedNodeId: lineage.selectedNodeId,
      executionAdapterKind: lineage.executionAdapterKind,
      executionBackendFamily: lineage.executionBackendFamily,
      updatedAt: lineage.updatedAt,
    },
  });
}

export function canViewGeneratedResultRecord(input: {
  readonly record: Pick<GeneratedResultPersistenceRecord, "visibility" | "ownerUserId">;
  readonly actorUserId: string;
  readonly isWorkspaceAdmin: boolean;
}): boolean {
  return !(
    input.record.visibility === "private"
    && Boolean(input.record.ownerUserId)
    && input.record.ownerUserId !== input.actorUserId
    && !input.isWorkspaceAdmin
  );
}

export function matchesPreviewStateFilter(
  preview: GeneratedResultMetadataPreviewSummary,
  allowedStates: ReadonlyArray<GeneratedResultPreviewState> | undefined,
): boolean {
  if (!allowedStates || allowedStates.length < 1) {
    return true;
  }
  return allowedStates.includes(preview.state);
}

export function matchesStatus(recordStatus: GeneratedResultAssetStatus, statuses: ReadonlyArray<GeneratedResultAssetStatus> | undefined): boolean {
  if (!statuses || statuses.length < 1) {
    return true;
  }
  return statuses.includes(recordStatus);
}
