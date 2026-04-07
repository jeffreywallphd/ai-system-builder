import type {
  NodeApprovalStatus,
  NodeEnrollmentRequestStatus,
  NodeHeartbeatStatus,
  NodeRevocationReason,
  NodeRevocationState,
  NodeRoleCapability,
  NodeTrustState,
  NodeType,
} from "@domain/nodes/NodeTrustDomain";
import {
  NodeEnrollmentRequestStatuses,
  NodeTrustStates,
} from "@domain/nodes/NodeTrustDomain";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

export interface NodeTrustPersistenceAuditStamp {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
}

export interface NodeTrustPersistenceWriteContext {
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NodeTrustPersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: NodeTrustPersistenceWriteContext;
}

export interface NodeTrustPersistenceMutationResult<TRecord> {
  readonly record: TRecord;
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

export interface NodeCapabilityProfilePersistenceRecord {
  readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
  readonly capabilityProfileVersion?: string;
  readonly supportsRemoteScheduling: boolean;
  readonly maxConcurrentWorkloads?: number;
}

export interface NodeCertificateReferencePersistenceRecord {
  readonly certificateRef: string;
  readonly certificateAssignedAt?: string;
  readonly certificateExpiresAt?: string;
  readonly certificateAuthorityRef?: string;
  readonly certificateThumbprint?: string;
}

export interface NodeLastSeenPersistenceRecord {
  readonly lastSeenAt: string;
  readonly heartbeatStatus: NodeHeartbeatStatus;
  readonly observedBy?: string;
}

export interface NodeRevocationPersistenceRecord {
  readonly state: NodeRevocationState;
  readonly reason?: NodeRevocationReason;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly note?: string;
}

export interface NodeIdentityPersistenceRecord extends NodeTrustPersistenceAuditStamp {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfilePersistenceRecord;
  readonly approvalStatus: NodeApprovalStatus;
  readonly trustState: NodeTrustState;
  readonly certificate?: NodeCertificateReferencePersistenceRecord;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly lastSeen?: NodeLastSeenPersistenceRecord;
  readonly revocation: NodeRevocationPersistenceRecord;
  readonly enrolledAt: string;
  readonly approvedAt?: string;
  readonly revokedAt?: string;
  readonly enrollmentRequestId?: string;
  readonly revision: number;
}

export interface NodeEnrollmentRequestPersistenceRecord extends NodeTrustPersistenceAuditStamp {
  readonly requestId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfilePersistenceRecord;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly certificateRef?: string;
  readonly requestedAt: string;
  readonly status: NodeEnrollmentRequestStatus;
  readonly reviewedAt?: string;
  readonly reviewedByUserIdentityId?: string;
  readonly decisionNote?: string;
  readonly revision: number;
}

export interface NodeIdentityPersistenceLookupQuery {
  readonly nodeTypes?: ReadonlyArray<NodeType>;
  readonly approvalStatuses?: ReadonlyArray<NodeApprovalStatus>;
  readonly trustStates?: ReadonlyArray<NodeTrustState>;
  readonly revocationStates?: ReadonlyArray<NodeRevocationState>;
  readonly capabilityAnyOf?: ReadonlyArray<NodeRoleCapability>;
  readonly deploymentTagAnyOf?: ReadonlyArray<string>;
  readonly certificateAssigned?: boolean;
  readonly activeOnly?: boolean;
  readonly includeRevoked?: boolean;
  readonly lastSeenAfter?: string;
  readonly lastSeenBefore?: string;
  readonly enrolledAfter?: string;
  readonly enrolledBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface NodeEnrollmentRequestPersistenceLookupQuery {
  readonly nodeId?: string;
  readonly nodeTypes?: ReadonlyArray<NodeType>;
  readonly statuses?: ReadonlyArray<NodeEnrollmentRequestStatus>;
  readonly requestedAfter?: string;
  readonly requestedBefore?: string;
  readonly reviewedByUserIdentityId?: string;
  readonly includeTerminal?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface RegisterNodeIdentityPersistenceRecordInput {
  readonly record: NodeIdentityPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export interface UpdateNodeApprovalPersistenceRecordInput {
  readonly nodeId: string;
  readonly approvalStatus: NodeApprovalStatus;
  readonly approvedAt?: string;
  readonly approvedByUserIdentityId?: string;
  readonly trustState?: NodeTrustState;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export interface UpdateNodeCertificateReferencePersistenceRecordInput {
  readonly nodeId: string;
  readonly certificate: NodeCertificateReferencePersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export interface UpdateNodeCapabilityProfilePersistenceRecordInput {
  readonly nodeId: string;
  readonly capabilityProfile: NodeCapabilityProfilePersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export interface RevokeNodeIdentityPersistenceRecordInput {
  readonly nodeId: string;
  readonly revocation: NodeRevocationPersistenceRecord;
  readonly trustState?: NodeTrustState;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export interface RecordNodeLastSeenPersistenceRecordInput {
  readonly nodeId: string;
  readonly lastSeen: NodeLastSeenPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export interface SaveNodeEnrollmentRequestPersistenceRecordInput {
  readonly record: NodeEnrollmentRequestPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export interface TransitionNodeEnrollmentRequestPersistenceRecordStatusInput {
  readonly requestId: string;
  readonly toStatus: NodeEnrollmentRequestStatus;
  readonly reviewedAt?: string;
  readonly reviewedByUserIdentityId?: string;
  readonly decisionNote?: string;
  readonly mutation: NodeTrustPersistenceMutationEnvelope;
}

export const NodeTrustPersistenceQueryPresets = Object.freeze({
  pendingEnrollmentRequestStatuses: Object.freeze([
    NodeEnrollmentRequestStatuses.submitted,
    NodeEnrollmentRequestStatuses.underReview,
  ]),
  activeNodeTrustStates: Object.freeze([
    NodeTrustStates.trusted,
  ]),
  revokedNodeTrustStates: Object.freeze([
    NodeTrustStates.revoked,
  ]),
});

export function toNodeCapabilityLookupKey(capability: NodeRoleCapability): string {
  return `capability:${capability}`;
}

export function toNodeDeploymentTagLookupKey(tag: string): string {
  return `tag:${tag.trim().toLowerCase()}`;
}

export function toNodeTrustStateLookupKey(trustState: NodeTrustState): string {
  return `trust-state:${trustState}`;
}

export function normalizeNodeTrustMutationOperationKey(operationKey: string): string {
  try {
    return normalizePersistenceOperationKey(operationKey);
  } catch {
    throw new Error("Node trust persistence mutation operationKey is required.");
  }
}

