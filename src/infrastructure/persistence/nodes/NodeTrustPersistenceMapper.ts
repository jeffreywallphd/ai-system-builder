import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
  type NodeApprovalStatus,
  type NodeEnrollmentRequestStatus,
  type NodeHeartbeatStatus,
  type NodeRevocationReason,
  type NodeRevocationState,
  type NodeRoleCapability,
  type NodeTrustState,
  type NodeType,
} from "@domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceRecord,
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import {
  parseNodeEnrollmentRequestPersistenceRecord,
  parseNodeIdentityPersistenceRecord,
} from "@shared/schemas/nodes/NodeTrustPersistenceSchemaContracts";

export interface NodeIdentityRow {
  readonly node_id: string;
  readonly node_type: NodeType;
  readonly display_name: string;
  readonly capability_enabled_json: string;
  readonly capability_profile_version: string | null;
  readonly supports_remote_scheduling: number;
  readonly max_concurrent_workloads: number | null;
  readonly approval_status: NodeApprovalStatus;
  readonly trust_state: NodeTrustState;
  readonly certificate_ref: string | null;
  readonly certificate_assigned_at: string | null;
  readonly certificate_expires_at: string | null;
  readonly certificate_authority_ref: string | null;
  readonly certificate_thumbprint: string | null;
  readonly deployment_tags_json: string;
  readonly last_seen_at: string | null;
  readonly heartbeat_status: NodeHeartbeatStatus | null;
  readonly last_seen_observed_by: string | null;
  readonly revocation_state: NodeRevocationState;
  readonly revocation_reason: NodeRevocationReason | null;
  readonly revocation_revoked_at: string | null;
  readonly revocation_revoked_by_user_identity_id: string | null;
  readonly revocation_note: string | null;
  readonly enrolled_at: string;
  readonly approved_at: string | null;
  readonly revoked_at: string | null;
  readonly enrollment_request_id: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface NodeEnrollmentRequestRow {
  readonly request_id: string;
  readonly node_id: string;
  readonly node_type: NodeType;
  readonly display_name: string;
  readonly capability_enabled_json: string;
  readonly capability_profile_version: string | null;
  readonly supports_remote_scheduling: number;
  readonly max_concurrent_workloads: number | null;
  readonly deployment_tags_json: string;
  readonly certificate_ref: string | null;
  readonly requested_at: string;
  readonly status: NodeEnrollmentRequestStatus;
  readonly reviewed_at: string | null;
  readonly reviewed_by_user_identity_id: string | null;
  readonly decision_note: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface NodeTrustMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: "node-identity" | "enrollment-request";
  readonly record_snapshot_json: string;
  readonly created_at: string;
}

export function mapNodeIdentityRowToRecord(row: NodeIdentityRow): NodeIdentityPersistenceRecord {
  const capabilityProfile = Object.freeze({
    enabledCapabilities: parseNodeRoleCapabilities(row.capability_enabled_json),
    capabilityProfileVersion: normalizeLookup(row.capability_profile_version),
    supportsRemoteScheduling: row.supports_remote_scheduling === 1,
    maxConcurrentWorkloads: row.max_concurrent_workloads ?? undefined,
  });

  const certificate = normalizeLookup(row.certificate_ref)
    ? Object.freeze({
      certificateRef: row.certificate_ref as string,
      certificateAssignedAt: normalizeLookup(row.certificate_assigned_at),
      certificateExpiresAt: normalizeLookup(row.certificate_expires_at),
      certificateAuthorityRef: normalizeLookup(row.certificate_authority_ref),
      certificateThumbprint: normalizeLookup(row.certificate_thumbprint),
    })
    : undefined;

  const lastSeen = normalizeLookup(row.last_seen_at)
    ? Object.freeze({
      lastSeenAt: row.last_seen_at as string,
      heartbeatStatus: assertNodeHeartbeatStatus(row.heartbeat_status),
      observedBy: normalizeLookup(row.last_seen_observed_by),
    })
    : undefined;

  const record: NodeIdentityPersistenceRecord = {
    nodeId: row.node_id,
    nodeType: assertNodeType(row.node_type),
    displayName: row.display_name,
    capabilityProfile,
    approvalStatus: assertNodeApprovalStatus(row.approval_status),
    trustState: assertNodeTrustState(row.trust_state),
    certificate,
    deploymentTags: parseDeploymentTags(row.deployment_tags_json),
    lastSeen,
    revocation: Object.freeze({
      state: assertNodeRevocationState(row.revocation_state),
      reason: row.revocation_reason ? assertNodeRevocationReason(row.revocation_reason) : undefined,
      revokedAt: normalizeLookup(row.revocation_revoked_at),
      revokedByUserIdentityId: normalizeLookup(row.revocation_revoked_by_user_identity_id),
      note: normalizeLookup(row.revocation_note),
    }),
    enrolledAt: row.enrolled_at,
    approvedAt: normalizeLookup(row.approved_at),
    revokedAt: normalizeLookup(row.revoked_at),
    enrollmentRequestId: normalizeLookup(row.enrollment_request_id),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  };

  return Object.freeze(parseNodeIdentityPersistenceRecord(record));
}

export function mapNodeIdentityRecordToRowValues(record: NodeIdentityPersistenceRecord): ReadonlyArray<unknown> {
  return Object.freeze([
    record.nodeId,
    record.nodeType,
    record.displayName,
    JSON.stringify(record.capabilityProfile.enabledCapabilities),
    record.capabilityProfile.capabilityProfileVersion ?? null,
    record.capabilityProfile.supportsRemoteScheduling ? 1 : 0,
    record.capabilityProfile.maxConcurrentWorkloads ?? null,
    record.approvalStatus,
    record.trustState,
    record.certificate?.certificateRef ?? null,
    record.certificate?.certificateAssignedAt ?? null,
    record.certificate?.certificateExpiresAt ?? null,
    record.certificate?.certificateAuthorityRef ?? null,
    record.certificate?.certificateThumbprint ?? null,
    JSON.stringify(record.deploymentTags),
    record.lastSeen?.lastSeenAt ?? null,
    record.lastSeen?.heartbeatStatus ?? null,
    record.lastSeen?.observedBy ?? null,
    record.revocation.state,
    record.revocation.reason ?? null,
    record.revocation.revokedAt ?? null,
    record.revocation.revokedByUserIdentityId ?? null,
    record.revocation.note ?? null,
    record.enrolledAt,
    record.approvedAt ?? null,
    record.revokedAt ?? null,
    record.enrollmentRequestId ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapNodeEnrollmentRequestRowToRecord(
  row: NodeEnrollmentRequestRow,
): NodeEnrollmentRequestPersistenceRecord {
  const record = parseNodeEnrollmentRequestPersistenceRecord({
    requestId: row.request_id,
    nodeId: row.node_id,
    nodeType: assertNodeType(row.node_type),
    displayName: row.display_name,
    capabilityProfile: Object.freeze({
      enabledCapabilities: parseNodeRoleCapabilities(row.capability_enabled_json),
      capabilityProfileVersion: normalizeLookup(row.capability_profile_version),
      supportsRemoteScheduling: row.supports_remote_scheduling === 1,
      maxConcurrentWorkloads: row.max_concurrent_workloads ?? undefined,
    }),
    deploymentTags: parseDeploymentTags(row.deployment_tags_json),
    certificateRef: normalizeLookup(row.certificate_ref),
    requestedAt: row.requested_at,
    status: assertNodeEnrollmentRequestStatus(row.status),
    reviewedAt: normalizeLookup(row.reviewed_at),
    reviewedByUserIdentityId: normalizeLookup(row.reviewed_by_user_identity_id),
    decisionNote: normalizeLookup(row.decision_note),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  });

  return Object.freeze(record);
}

export function mapNodeEnrollmentRequestRecordToRowValues(
  record: NodeEnrollmentRequestPersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.requestId,
    record.nodeId,
    record.nodeType,
    record.displayName,
    JSON.stringify(record.capabilityProfile.enabledCapabilities),
    record.capabilityProfile.capabilityProfileVersion ?? null,
    record.capabilityProfile.supportsRemoteScheduling ? 1 : 0,
    record.capabilityProfile.maxConcurrentWorkloads ?? null,
    JSON.stringify(record.deploymentTags),
    record.certificateRef ?? null,
    record.requestedAt,
    record.status,
    record.reviewedAt ?? null,
    record.reviewedByUserIdentityId ?? null,
    record.decisionNote ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function parseNodeTrustMutationReplayRecord<TRecord>(row: NodeTrustMutationReplayRow): TRecord {
  try {
    return JSON.parse(row.record_snapshot_json) as TRecord;
  } catch {
    throw new Error(`Node trust mutation replay snapshot for operation '${row.operation_key}' is malformed.`);
  }
}

export function normalizeNodeTrustLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseNodeRoleCapabilities(value: string): ReadonlyArray<NodeRoleCapability> {
  const normalized = parseStringArray(value)
    .map((entry) => {
      const normalized = normalizeNodeRoleCapability(entry);
      if (!normalized) {
        throw new Error(`Persisted node capability '${entry}' is invalid.`);
      }
      return normalized;
    })
    .filter((entry, index, source) => source.indexOf(entry) === index);

  return createNodeCapabilityProfile({
    enabledCapabilities: normalized,
  }).enabledCapabilities;
}

function parseDeploymentTags(value: string): ReadonlyArray<string> {
  const tags = parseStringArray(value)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, source) => entry.length > 0 && source.indexOf(entry) === index);
  return Object.freeze(tags);
}

function parseStringArray(value: string): ReadonlyArray<string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }
    return Object.freeze(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return Object.freeze([]);
  }
}

function assertNodeType(value: string): NodeType {
  if (Object.values(NodeTypes).includes(value as NodeType)) {
    return value as NodeType;
  }
  throw new Error(`Persisted node type '${value}' is invalid.`);
}

function assertNodeApprovalStatus(value: string): NodeApprovalStatus {
  if (Object.values(NodeApprovalStatuses).includes(value as NodeApprovalStatus)) {
    return value as NodeApprovalStatus;
  }
  throw new Error(`Persisted node approval status '${value}' is invalid.`);
}

function assertNodeTrustState(value: string): NodeTrustState {
  if (Object.values(NodeTrustStates).includes(value as NodeTrustState)) {
    return value as NodeTrustState;
  }
  throw new Error(`Persisted node trust state '${value}' is invalid.`);
}

function assertNodeRevocationState(value: string): NodeRevocationState {
  if (Object.values(NodeRevocationStates).includes(value as NodeRevocationState)) {
    return value as NodeRevocationState;
  }
  throw new Error(`Persisted node revocation state '${value}' is invalid.`);
}

function assertNodeRevocationReason(value: string | null): NodeRevocationReason {
  if (!value) {
    throw new Error("Persisted node revocation reason is missing.");
  }
  if (Object.values(NodeRevocationReasons).includes(value as NodeRevocationReason)) {
    return value as NodeRevocationReason;
  }
  throw new Error(`Persisted node revocation reason '${value}' is invalid.`);
}

function assertNodeHeartbeatStatus(value: string | null): NodeHeartbeatStatus {
  if (!value) {
    throw new Error("Persisted node heartbeat status is missing.");
  }
  if (Object.values(NodeHeartbeatStatuses).includes(value as NodeHeartbeatStatus)) {
    return value as NodeHeartbeatStatus;
  }
  throw new Error(`Persisted node heartbeat status '${value}' is invalid.`);
}

function normalizeNodeRoleCapability(value: string): NodeRoleCapability | undefined {
  if (Object.values(NodeRoleCapabilities).includes(value as NodeRoleCapability)) {
    return value as NodeRoleCapability;
  }

  switch (value) {
    case "workflow-execution":
    case "model-training":
      return NodeRoleCapabilities.executor;
    case "model-inference":
    case "mcp-tool-execution":
      return NodeRoleCapabilities.api;
    case "scheduling-participation":
      return NodeRoleCapabilities.scheduler;
    default:
      return undefined;
  }
}

function assertNodeEnrollmentRequestStatus(value: string): NodeEnrollmentRequestStatus {
  if (Object.values(NodeEnrollmentRequestStatuses).includes(value as NodeEnrollmentRequestStatus)) {
    return value as NodeEnrollmentRequestStatus;
  }
  throw new Error(`Persisted node enrollment request status '${value}' is invalid.`);
}

