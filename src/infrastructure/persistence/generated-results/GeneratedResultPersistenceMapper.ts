import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import {
  normalizeGeneratedResultPersistenceOperationKey,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import {
  normalizePersistenceLookup,
  toPersistenceTenancyScopeFields,
} from "../common/PersistenceMapperUtilities";
import {
  createMixedTenancyMetadata,
  createNodeTenancyMetadata,
  createPlatformTenancyMetadata,
  createUserTenancyMetadata,
  createWorkspaceTenancyMetadata,
} from "@shared/persistence/PersistenceTenancyMetadataFactory";
import { PersistenceTenancyScopes, type PersistenceTenancyMetadata } from "@shared/dto/persistence/PersistenceBoundaryDtos";

export interface GeneratedResultRecordRow {
  readonly result_asset_id: string;
  readonly workspace_id: string;
  readonly owner_user_id: string | null;
  readonly run_id: string;
  readonly system_id: string;
  readonly workflow_id: string;
  readonly workflow_template_id: string | null;
  readonly execution_node_id: string | null;
  readonly output_slot: string;
  readonly workflow_template_version_id: string | null;
  readonly workflow_template_version_tag: string | null;
  readonly system_snapshot_id: string | null;
  readonly system_version_tag: string | null;
  readonly parameter_snapshot_id: string | null;
  readonly selected_node_id: string | null;
  readonly execution_adapter_kind: string | null;
  readonly execution_backend_family: string | null;
  readonly visibility: GeneratedResultPersistenceRecord["visibility"];
  readonly sharing_policy_id: string | null;
  readonly sharing_policy_version: string | null;
  readonly storage_instance_id: string;
  readonly storage_binding_reference: string | null;
  readonly media_type: string | null;
  readonly status: GeneratedResultPersistenceRecord["status"];
  readonly pending_since: string;
  readonly logical_asset_version_id: string | null;
  readonly persisted_at: string | null;
  readonly persisted_by: string | null;
  readonly preview_ready_at: string | null;
  readonly preview_ready_by: string | null;
  readonly failed_at: string | null;
  readonly failed_by: string | null;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly archived_at: string | null;
  readonly archived_by: string | null;
  readonly tenancy_scope: string;
  readonly tenancy_workspace_id: string | null;
  readonly tenancy_user_identity_id: string | null;
  readonly tenancy_node_id: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
  readonly schema_version: number;
}

export interface GeneratedResultPreviewRow {
  readonly derivative_id: string;
  readonly result_asset_id: string;
  readonly result_logical_asset_version_id: string | null;
  readonly preview_kind: GeneratedResultPreviewPersistenceRecord["previewKind"];
  readonly availability_status: GeneratedResultPreviewPersistenceRecord["availabilityStatus"];
  readonly is_primary_preview: number;
  readonly protected_resource_id: string | null;
  readonly access_handle: string | null;
  readonly media_type: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly byte_size: number | null;
  readonly generated_at: string | null;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly tenancy_scope: string;
  readonly tenancy_workspace_id: string | null;
  readonly tenancy_user_identity_id: string | null;
  readonly tenancy_node_id: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
  readonly schema_version: number;
}

export interface GeneratedResultMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_snapshot_json: string;
}

function mapGeneratedResultTenancy(input: {
  readonly scope: string;
  readonly workspaceId?: string | null;
  readonly userIdentityId?: string | null;
  readonly nodeId?: string | null;
}): PersistenceTenancyMetadata {
  const workspaceId = normalizePersistenceLookup(input.workspaceId);
  const userIdentityId = normalizePersistenceLookup(input.userIdentityId);
  const nodeId = normalizePersistenceLookup(input.nodeId);

  if (input.scope === PersistenceTenancyScopes.mixed) {
    return createMixedTenancyMetadata({
      workspaceId,
      userIdentityId,
      nodeId,
    });
  }
  if (input.scope === PersistenceTenancyScopes.workspace && workspaceId) {
    return createWorkspaceTenancyMetadata(workspaceId);
  }
  if (input.scope === PersistenceTenancyScopes.user && userIdentityId) {
    return createUserTenancyMetadata(userIdentityId);
  }
  if (input.scope === PersistenceTenancyScopes.node && nodeId) {
    return createNodeTenancyMetadata(nodeId);
  }

  if (workspaceId && userIdentityId) {
    return createMixedTenancyMetadata({
      workspaceId,
      userIdentityId,
      nodeId,
    });
  }
  if (workspaceId && nodeId) {
    return createMixedTenancyMetadata({
      workspaceId,
      nodeId,
    });
  }
  if (userIdentityId && nodeId) {
    return createMixedTenancyMetadata({
      userIdentityId,
      nodeId,
    });
  }
  if (workspaceId) {
    return createWorkspaceTenancyMetadata(workspaceId);
  }
  if (userIdentityId) {
    return createUserTenancyMetadata(userIdentityId);
  }
  if (nodeId) {
    return createNodeTenancyMetadata(nodeId);
  }

  return createPlatformTenancyMetadata();
}

export function normalizeGeneratedResultLookup(value: string | null | undefined): string | undefined {
  return normalizePersistenceLookup(value);
}

export function normalizeGeneratedResultOperationKey(operationKey: string): string {
  return normalizeGeneratedResultPersistenceOperationKey(operationKey);
}

export function toGeneratedResultRecordRowValues(input: {
  readonly record: GeneratedResultPersistenceRecord;
  readonly revision: number;
  readonly schemaVersion: number;
}): readonly unknown[] {
  const tenancy = toPersistenceTenancyScopeFields(input.record.tenancy);
  return Object.freeze([
    input.record.resultAssetId,
    input.record.workspaceId,
    input.record.ownerUserId ?? null,
    input.record.runId,
    input.record.systemId,
    input.record.workflowId,
    input.record.workflowTemplateId ?? null,
    input.record.executionNodeId ?? null,
    input.record.outputSlot,
    input.record.workflowTemplateVersionId ?? null,
    input.record.workflowTemplateVersionTag ?? null,
    input.record.systemSnapshotId ?? null,
    input.record.systemVersionTag ?? null,
    input.record.parameterSnapshotId ?? null,
    input.record.selectedNodeId ?? null,
    input.record.executionAdapterKind ?? null,
    input.record.executionBackendFamily ?? null,
    input.record.visibility,
    input.record.sharingPolicyId ?? null,
    input.record.sharingPolicyVersion ?? null,
    input.record.storageInstanceId,
    input.record.storageBindingReference ?? null,
    input.record.mediaType ?? null,
    input.record.status,
    input.record.pendingSince,
    input.record.logicalAssetVersionId ?? null,
    input.record.persistedAt ?? null,
    input.record.persistedBy ?? null,
    input.record.previewReadyAt ?? null,
    input.record.previewReadyBy ?? null,
    input.record.failedAt ?? null,
    input.record.failedBy ?? null,
    input.record.failureCode ?? null,
    input.record.failureMessage ?? null,
    input.record.archivedAt ?? null,
    input.record.archivedBy ?? null,
    input.record.tenancy.scope,
    tenancy.workspaceId ?? null,
    tenancy.userIdentityId ?? null,
    tenancy.nodeId ?? null,
    input.record.createdAt,
    input.record.createdBy,
    input.record.lastModifiedAt,
    input.record.lastModifiedBy,
    input.revision,
    input.schemaVersion,
  ]);
}

export function toGeneratedResultPreviewRowValues(input: {
  readonly record: GeneratedResultPreviewPersistenceRecord;
  readonly revision: number;
  readonly schemaVersion: number;
}): readonly unknown[] {
  const tenancy = toPersistenceTenancyScopeFields(input.record.tenancy);
  return Object.freeze([
    input.record.derivativeId,
    input.record.resultAssetId,
    input.record.resultLogicalAssetVersionId ?? null,
    input.record.previewKind,
    input.record.availabilityStatus,
    input.record.isPrimaryPreview ? 1 : 0,
    input.record.protectedResourceId ?? null,
    input.record.accessHandle ?? null,
    input.record.mediaType ?? null,
    input.record.width ?? null,
    input.record.height ?? null,
    input.record.byteSize ?? null,
    input.record.generatedAt ?? null,
    input.record.failureCode ?? null,
    input.record.failureMessage ?? null,
    input.record.tenancy.scope,
    tenancy.workspaceId ?? null,
    tenancy.userIdentityId ?? null,
    tenancy.nodeId ?? null,
    input.record.createdAt,
    input.record.createdBy,
    input.record.lastModifiedAt,
    input.record.lastModifiedBy,
    input.revision,
    input.schemaVersion,
  ]);
}

export function mapGeneratedResultRowToRecord(
  row: GeneratedResultRecordRow,
  inputAssetIds: ReadonlyArray<string>,
): GeneratedResultPersistenceRecord {
  return Object.freeze({
    resultAssetId: row.result_asset_id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id ?? undefined,
    runId: row.run_id,
    systemId: row.system_id,
    workflowId: row.workflow_id,
    workflowTemplateId: row.workflow_template_id ?? undefined,
    executionNodeId: row.execution_node_id ?? undefined,
    outputSlot: row.output_slot,
    inputAssetIds: Object.freeze([...inputAssetIds]),
    workflowTemplateVersionId: row.workflow_template_version_id ?? undefined,
    workflowTemplateVersionTag: row.workflow_template_version_tag ?? undefined,
    systemSnapshotId: row.system_snapshot_id ?? undefined,
    systemVersionTag: row.system_version_tag ?? undefined,
    parameterSnapshotId: row.parameter_snapshot_id ?? undefined,
    selectedNodeId: row.selected_node_id ?? undefined,
    executionAdapterKind: row.execution_adapter_kind ?? undefined,
    executionBackendFamily: row.execution_backend_family ?? undefined,
    visibility: row.visibility,
    sharingPolicyId: row.sharing_policy_id ?? undefined,
    sharingPolicyVersion: row.sharing_policy_version ?? undefined,
    storageInstanceId: row.storage_instance_id,
    storageBindingReference: row.storage_binding_reference ?? undefined,
    mediaType: (row.media_type ?? undefined) as GeneratedResultPersistenceRecord["mediaType"],
    status: row.status,
    pendingSince: row.pending_since,
    logicalAssetVersionId: row.logical_asset_version_id ?? undefined,
    persistedAt: row.persisted_at ?? undefined,
    persistedBy: row.persisted_by ?? undefined,
    previewReadyAt: row.preview_ready_at ?? undefined,
    previewReadyBy: row.preview_ready_by ?? undefined,
    failedAt: row.failed_at ?? undefined,
    failedBy: row.failed_by ?? undefined,
    failureCode: row.failure_code ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedBy: row.archived_by ?? undefined,
    tenancy: mapGeneratedResultTenancy({
      scope: row.tenancy_scope,
      workspaceId: row.tenancy_workspace_id,
      userIdentityId: row.tenancy_user_identity_id,
      nodeId: row.tenancy_node_id,
    }),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
    schemaVersion: row.schema_version,
  });
}

export function mapGeneratedResultPreviewRowToRecord(row: GeneratedResultPreviewRow): GeneratedResultPreviewPersistenceRecord {
  return Object.freeze({
    derivativeId: row.derivative_id,
    resultAssetId: row.result_asset_id,
    resultLogicalAssetVersionId: row.result_logical_asset_version_id ?? undefined,
    previewKind: row.preview_kind,
    availabilityStatus: row.availability_status,
    isPrimaryPreview: row.is_primary_preview === 1,
    protectedResourceId: row.protected_resource_id ?? undefined,
    accessHandle: row.access_handle ?? undefined,
    mediaType: (row.media_type ?? undefined) as GeneratedResultPreviewPersistenceRecord["mediaType"],
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    byteSize: row.byte_size ?? undefined,
    generatedAt: row.generated_at ?? undefined,
    failureCode: row.failure_code ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    tenancy: mapGeneratedResultTenancy({
      scope: row.tenancy_scope,
      workspaceId: row.tenancy_workspace_id,
      userIdentityId: row.tenancy_user_identity_id,
      nodeId: row.tenancy_node_id,
    }),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
    schemaVersion: row.schema_version,
  });
}

export function parseGeneratedResultMutationReplayRow<TSnapshot>(
  row: GeneratedResultMutationReplayRow,
): TSnapshot {
  const parsed = JSON.parse(row.mutation_snapshot_json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Generated-result replay '${row.operation_key}' has invalid snapshot payload.`);
  }
  return parsed as TSnapshot;
}

export function toGeneratedResultMutationContextMetadata(
  mutation: GeneratedResultPersistenceMutationEnvelope,
): Readonly<Record<string, unknown>> | undefined {
  return mutation.context.metadata ? Object.freeze({ ...mutation.context.metadata }) : undefined;
}
